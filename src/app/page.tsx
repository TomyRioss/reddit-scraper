'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface Post {
  id: string; subreddit: string; title: string; selftext: string;
  url: string; score: number; num_comments: number; created_utc: number;
  relevance: number; keywords_matched: string; ai_summary: string | null;
  ai_score: number | null; seen: number;
}
interface Stats { total: number; unread: number; withAi: number }
interface SubItem { name: string; label: string; subscribers: number; lang: string }

function timeAgo(utc: number) {
  const d = Date.now() / 1000 - utc;
  if (d < 60) return 'ahora';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function Stars({ n }: { n: number }) {
  const v = Math.round(n);
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= v ? 'text-amber-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, withAi: 0 });
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [activeSub, setActiveSub] = useState('all');
  const [sort, setSort] = useState('stars');
  const [search, setSearch] = useState('');
  const [minS, setMinS] = useState(0);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState({ scrape: false, analyze: false });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chat, setChat] = useState<{role:string;content:string}[]>([]);
  const [chatLoad, setChatLoad] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ limit: '300' });
    if (activeSub !== 'all') p.set(activeSub === 'unread' ? 'unread' : 'subreddit', 'true');
    const r = await fetch(`/api/offers?${p}`);
    const d = await r.json();
    setPosts(d.posts || []); setStats(d.stats || {});
    setSubs(d.subreddits || []);
  }, [activeSub]);

  useEffect(() => { load(); }, [load]);

  const doScrape = async () => {
    setLoading(p => ({ ...p, scrape: true })); setMsg('');
    const r = await fetch('/api/scrape', { method: 'POST' });
    const d = await r.json();
    setMsg(`📥 ${d.totalSaved} nuevas ofertas` + (d.errors?.length ? ` · ⚠️ ${d.errors.length} errores` : ''));
    setLoading(p => ({ ...p, scrape: false })); load();
  };

  const doAnalyze = async () => {
    setLoading(p => ({ ...p, analyze: true })); setMsg('');
    const r = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ rate: true }) });
    const d = await r.json();
    setMsg(`🤖 ${d.good} buenas · 🗑️ ${d.aggregator + d.fulltime + d.filtered} filtradas · ${d.total} total`);
    setLoading(p => ({ ...p, analyze: false })); load();
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoad) return;
    const h = [...chat, { role: 'user', content: chatMsg }];
    setChat(h); setChatMsg(''); setChatLoad(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: h.slice(-8) }) });
      const d = await r.json();
      setChat(p => [...p, { role: 'assistant', content: d.reply }]);
    } catch { setChat(p => [...p, { role: 'assistant', content: 'Error de conexión' }]); }
    setChatLoad(false);
  };

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const starScore = (p: Post) => Math.round((p.ai_score ?? p.relevance) / 2);

  let filtered = [...posts];
  if (search) { const s = search.toLowerCase(); filtered = filtered.filter(p => p.title.toLowerCase().includes(s) || p.keywords_matched.toLowerCase().includes(s)); }
  if (sort === 'stars') filtered.sort((a, b) => starScore(b) - starScore(a) || b.created_utc - a.created_utc);
  else if (sort === 'new') filtered.sort((a, b) => b.created_utc - a.created_utc);
  else if (sort === 'rel') filtered.sort((a, b) => b.relevance - a.relevance);
  if (minS > 0) filtered = filtered.filter(p => starScore(p) >= minS);

  const subsList = ['all', 'unread', ...subs.map(s => s.name)];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans antialiased">
      <style>{`
        * { scrollbar-width: thin; scrollbar-color: #1e1e2e transparent; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.25s ease-out forwards; }
        @keyframes pulse-dot { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .pulse-dot { animation: pulse-dot 1.4s infinite; }
      `}</style>

      {/* === TOP NAV === */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚀</span>
              <h1 className="text-sm font-semibold tracking-tight text-white/90">Offers</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full font-mono">{stats.total}</span>
              {stats.unread > 0 && <span className="text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{stats.unread} new</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={doScrape} disabled={loading.scrape}
              className="px-2.5 py-1.5 bg-indigo-500/90 hover:bg-indigo-400 disabled:opacity-30 rounded-lg text-[11px] font-medium transition-all active:scale-95">
              {loading.scrape ? '⏳' : '🔄'} Scrape
            </button>
            <button onClick={doAnalyze} disabled={loading.analyze}
              className="px-2.5 py-1.5 bg-amber-500/90 hover:bg-amber-400 disabled:opacity-30 rounded-lg text-[11px] font-medium transition-all active:scale-95">
              {loading.analyze ? '⏳' : '⭐'} Rate
            </button>
            <button onClick={() => setChatOpen(true)}
              className="px-2.5 py-1.5 bg-violet-500/90 hover:bg-violet-400 rounded-lg text-[11px] font-medium transition-all active:scale-95">
              💬 AI Chat
            </button>
          </div>
        </div>
        {msg && <div className="max-w-5xl mx-auto px-4 pb-2.5 text-[11px] text-white/50">{msg}</div>}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* === FILTERS === */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search offers..."
              className="w-40 bg-white/5 border border-white/10 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none">
            <option value="stars">⭐ Best rated</option>
            <option value="new">🕐 Newest</option>
            <option value="rel">📊 Relevance</option>
          </select>
          <select value={minS} onChange={e => setMinS(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none">
            <option value="0">⭐ Min 0</option>
            <option value="1">⭐ Min 1</option>
            <option value="2">⭐ Min 2</option>
            <option value="3">⭐ Min 3</option>
            <option value="4">⭐ Min 4</option>
          </select>
          <div className="flex gap-1 flex-wrap">
            {subsList.map(s => (
              <button key={s} onClick={() => setActiveSub(s)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  activeSub === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}>
                {s === 'all' ? 'All' : s === 'unread' ? 'New' : s}
              </button>
            ))}
          </div>
        </div>

        {/* === STATS === */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          {[
            { l: 'Total', v: stats.total, c: 'text-indigo-300' },
            { l: 'Unread', v: stats.unread, c: 'text-emerald-300' },
            { l: 'Rated', v: stats.withAi, c: 'text-amber-300' },
            { l: 'Sources', v: subs.length, c: 'text-rose-300' },
          ].map(s => (
            <div key={s.l} className="fade-in bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center">
              <div className={`text-lg font-bold tabular-nums ${s.c}`}>{s.v}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>

        {/* === OFFERS === */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-20 text-white/20">
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-xs">No offers found. Scrape some subreddits first.</p>
            </div>
          )}
          {filtered.map((post, i) => {
            const stars = starScore(post);
            const tags = post.keywords_matched?.split(', ').filter(Boolean).slice(0, 8);
            const open = expanded === post.id;
            return (
              <div key={post.id}
                className={`fade-in group bg-white/[0.02] border ${open ? 'border-indigo-500/30' : 'border-white/[0.06]'} rounded-2xl hover:border-white/[0.12] transition-all cursor-pointer ${!post.seen ? 'border-l-2 border-l-indigo-500/50' : 'opacity-40 hover:opacity-70'}`}
                onClick={() => setExpanded(open ? null : post.id)}
                style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}>
                
                <div className="p-3.5">
                  <div className="flex items-start gap-3">
                    {/* Left - Stars */}
                    <div className="shrink-0 w-14 text-center pt-0.5">
                      <Stars n={stars} />
                      <div className="text-[9px] text-white/20 font-mono mt-1">{post.relevance}pts</div>
                    </div>
                    {/* Middle - Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                          r/{post.subreddit}
                        </span>
                        <span className="text-[10px] text-white/30">{timeAgo(post.created_utc)}</span>
                        {!post.seen && <span className="text-[9px] bg-emerald-500/15 text-emerald-400/80 px-1.5 py-0.5 rounded-full font-medium">NEW</span>}
                        {post.score > 0 && <span className="text-[10px] text-rose-400/60">▲{post.score}</span>}
                        {post.num_comments > 0 && <span className="text-[10px] text-white/30">💬{post.num_comments}</span>}
                      </div>
                      <h3 className="text-sm font-medium leading-snug text-white/90 group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      {open && post.ai_summary && (
                        <p className="text-xs text-white/40 mt-1.5 italic leading-relaxed border-l-2 border-amber-500/30 pl-2.5">{post.ai_summary}</p>
                      )}
                      {open && (
                        <div className="flex gap-2 mt-2.5">
                          <a href={post.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] bg-white/5 hover:bg-white/10 text-white/60 px-2.5 py-1 rounded-lg transition-colors">
                            🔗 Open on Reddit
                          </a>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {tags.slice(0, open ? 12 : 5).map(t => (
                            <span key={t} className="text-[9px] bg-white/[0.04] text-white/30 px-1.5 py-0.5 rounded-full border border-white/[0.06]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Right - Expand indicator */}
                    <div className="shrink-0 pt-1 text-white/20 text-xs">{open ? '▲' : '▼'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-[10px] text-white/15 text-center font-mono">
          reddit-scraper · {filtered.length} offers · OpenCode DeepSeek V4 Flash
        </div>
      </div>

      {/* === CHAT OVERLAY === */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setChatOpen(false)}>
          <div className="bg-[#0f0f1a] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:w-[400px] h-[70vh] sm:h-[520px] flex flex-col shadow-2xl sm:shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-sm font-medium text-white/80">🤖 AI Assistant</span>
              <button onClick={() => setChatOpen(false)} className="text-white/30 hover:text-white/70 text-lg leading-none transition-colors">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-sm">
              {chat.length === 0 && (
                <div className="text-white/30 text-center py-8 space-y-2">
                  <p className="text-xs">Ask me about available offers.</p>
                  {['Show me React/Next.js offers', 'Best freelance projects today', 'Backend opportunities', 'Full-stack offers with good budget'].map(q => (
                    <button key={q} onClick={() => setChatMsg(q)}
                      className="block w-full text-left text-xs bg-white/5 p-2.5 rounded-xl hover:bg-white/10 text-white/50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-in`}>
                  <div className={`max-w-[88%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/20' : 'bg-white/5 text-white/70'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoad && (
                <div className="flex justify-start fade-in">
                  <div className="bg-white/5 p-3 rounded-2xl text-xs text-white/30">
                    <span className="inline-flex gap-1">
                      <span className="pulse-dot">●</span>
                      <span className="pulse-dot" style={{ animationDelay: '0.3s' }}>●</span>
                      <span className="pulse-dot" style={{ animationDelay: '0.6s' }}>●</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about offers..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors" />
              <button onClick={sendChat} disabled={chatLoad || !chatMsg.trim()}
                className="bg-violet-500/80 hover:bg-violet-400 disabled:opacity-30 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
