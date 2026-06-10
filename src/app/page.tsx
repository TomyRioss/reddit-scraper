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
  const diff = Date.now() / 1000 - utc;
  if (diff < 60) return 'justo ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function Stars({ n }: { n: number }) {
  const val = Math.round(n);
  return <span className="text-yellow-400 text-sm">{'★'.repeat(Math.max(0, Math.min(5, val)))}{'☆'.repeat(Math.max(0, 5 - Math.min(5, val)))}</span>;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, withAi: 0 });
  const [subreddits, setSubreddits] = useState<SubItem[]>([]);
  const [activeSub, setActiveSub] = useState('all');
  const [sortBy, setSortBy] = useState('stars');
  const [search, setSearch] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [scrapeMsg, setScrapeMsg] = useState('');
  const [scraping, setScraping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHist, setChatHist] = useState<{role:string;content:string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (activeSub !== 'all') p.set(activeSub === 'unread' ? 'unread' : 'subreddit', 'true');
    p.set('limit', '300');
    const r = await fetch(`/api/offers?${p}`);
    const d = await r.json();
    setPosts(d.posts || []);
    setStats(d.stats || { total: 0, unread: 0, withAi: 0 });
    setSubreddits(d.subreddits || []);
  }, [activeSub]);

  useEffect(() => { load(); }, [load]);

  const doScrape = async () => {
    setScraping(true); setScrapeMsg('');
    const r = await fetch('/api/scrape', { method: 'POST' });
    const d = await r.json();
    setScrapeMsg(`✅ ${d.totalSaved} nuevas ofertas` + (d.errors?.length ? ` · ⚠️ ${d.errors.length} errores` : ''));
    setScraping(false); load();
  };

  const doAnalyze = async () => {
    setAnalyzing(true); setScrapeMsg('');
    const r = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ rate: true }) });
    const d = await r.json();
    setScrapeMsg(`🤖 ${d.good} buenas · 🗑️ ${d.aggregator + d.fulltime + d.filtered} filtradas (${d.total} total)`);
    setAnalyzing(false); load();
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoading) return;
    const h = [...chatHist, { role: 'user', content: chatMsg }];
    setChatHist(h); setChatMsg(''); setChatLoading(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: h.slice(-10) }) });
      const d = await r.json();
      setChatHist(prev => [...prev, { role: 'assistant', content: d.reply }]);
    } catch { setChatHist(prev => [...prev, { role: 'assistant', content: 'Error de conexión' }]); }
    setChatLoading(false);
  };

  useEffect(() => { chatRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHist]);

  // Filter + Sort
  let filtered = [...posts];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(s) || p.keywords_matched.toLowerCase().includes(s));
  }
  const starScore = (p: Post) => Math.round((p.ai_score ?? p.relevance) / 2);
  if (sortBy === 'stars') filtered.sort((a, b) => starScore(b) - starScore(a) || b.created_utc - a.created_utc);
  else if (sortBy === 'new') filtered.sort((a, b) => b.created_utc - a.created_utc);
  else if (sortBy === 'relevance') filtered.sort((a, b) => b.relevance - a.relevance);
  if (minStars > 0) filtered = filtered.filter(p => starScore(p) >= minStars);

  const subs = ['all', 'unread', ...subreddits.map(s => s.name)];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold tracking-tight">🚀 Freelance Offers</h1>
            <span className="text-[11px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{stats.total} ofertas</span>
            {stats.unread > 0 && <span className="text-[11px] bg-green-900 text-green-300 px-2 py-0.5 rounded-full">{stats.unread} nuevas</span>}
          </div>
          <div className="flex gap-1.5">
            <button onClick={doScrape} disabled={scraping} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-[11px] font-medium transition">{scraping ? '⏳' : '🔄'} Scrapear</button>
            <button onClick={doAnalyze} disabled={analyzing} className="px-2.5 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-[11px] font-medium transition">{analyzing ? '⏳' : '🤖'} Calificar</button>
            <button onClick={() => setChatOpen(!chatOpen)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${chatOpen ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-500'}`}>💬 Chat</button>
          </div>
        </div>
        {scrapeMsg && <div className="max-w-6xl mx-auto px-4 pb-2 text-[11px] text-gray-400">{scrapeMsg}</div>}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-3">
        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar..." className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-2.5 py-1.5 text-xs w-36 focus:outline-none focus:border-blue-500/60" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
            <option value="stars">⭐ Por estrellas</option>
            <option value="new">🕐 Más recientes</option>
            <option value="relevance">📊 Por relevancia</option>
          </select>
          <select value={minStars} onChange={e => setMinStars(Number(e.target.value))} className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
            <option value="0">⭐ Mín: 0</option>
            <option value="1">⭐ Mín: 1</option>
            <option value="2">⭐ Mín: 2</option>
            <option value="3">⭐ Mín: 3</option>
            <option value="4">⭐ Mín: 4</option>
            <option value="5">⭐ Mín: 5</option>
          </select>
          <div className="flex gap-1 flex-wrap">
            {subs.map(s => {
              const label = s === 'all' ? 'Todo' : s === 'unread' ? `Nuevos` : s;
              return (
                <button key={s} onClick={() => setActiveSub(s)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition ${activeSub === s ? 'bg-blue-600/80 text-white' : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60'}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-blue-300' },
            { label: 'Sin leer', value: stats.unread, color: 'text-green-300' },
            { label: 'Analizados', value: stats.withAi, color: 'text-purple-300' },
            { label: 'Fuentes', value: subreddits.length, color: 'text-yellow-300' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-2.5 text-center">
              <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>

        {/* OFFERS LIST */}
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-16">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-xs">No hay ofertas. Scrapeá para empezar o ajustá los filtros.</p>
            </div>
          )}
          {filtered.map(post => {
            const stars = Math.round((post.ai_score ?? post.relevance) / 2);
            const tags = post.keywords_matched?.split(', ').filter(Boolean).slice(0, 6);
            return (
              <a key={post.id} href={post.url} target="_blank" rel="noopener noreferrer"
                className={`block p-3 bg-gray-900/40 border border-gray-800/50 rounded-xl hover:border-gray-600/60 hover:bg-gray-900/70 transition-all group ${!post.seen ? 'border-l-blue-500 border-l-2' : 'opacity-50'}`}>
                <div className="flex items-start gap-2.5">
                  {/* Stars column */}
                  <div className="shrink-0 w-12 text-center pt-0.5">
                    <div className="text-xs leading-tight"><Stars n={stars} /></div>
                    <div className="text-[9px] text-gray-600 font-mono mt-0.5">{post.relevance}pts</div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">
                        r/{post.subreddit}
                      </span>
                      <span className="text-[10px] text-gray-500">{timeAgo(post.created_utc)}</span>
                      {!post.seen && <span className="text-[9px] bg-green-800 text-green-200 px-1.5 py-0.5 rounded-full font-medium">NEW</span>}
                      {post.score > 0 && <span className="text-[10px] text-orange-400/80">⬆{post.score}</span>}
                      {post.num_comments > 0 && <span className="text-[10px] text-gray-500">💬{post.num_comments}</span>}
                    </div>
                    <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-blue-300 transition-colors">
                      {post.title}
                    </h3>
                    {post.ai_summary && (
                      <p className="text-[11px] text-gray-400/80 mt-1 line-clamp-2 italic border-l-2 border-purple-800/50 pl-2">{post.ai_summary}</p>
                    )}
                    {tags && tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {tags.map(t => (
                          <span key={t} className="text-[9px] bg-gray-800/60 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-700/50">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-6 text-[10px] text-gray-700 text-center">
          Reddit Freelance Scraper · {filtered.length} ofertas mostradas · OpenCode DeepSeek V4 Flash
        </div>
      </div>

      {/* CHAT SIDEBAR */}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-gray-900 border-l border-gray-800/80 shadow-2xl transform transition-transform ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm font-medium">🤖 Chat sobre ofertas</span>
            <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {chatHist.length === 0 && (
              <div className="text-gray-500 text-center py-6 space-y-2">
                <p>Hacé preguntas sobre las ofertas disponibles.</p>
                {[
                  '¿Cuáles son las mejores ofertas hoy?',
                  'Mostrame ofertas de React',
                  'Recomendame proyectos para backend',
                  'Filtrá ofertas con más de 3 estrellas',
                ].map(q => (
                  <button key={q} onClick={() => { setChatMsg(q); }}
                    className="block w-full text-left bg-gray-800/60 p-2 rounded-lg hover:bg-gray-700/60 text-gray-300">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {chatHist.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] p-2.5 rounded-2xl leading-relaxed ${m.role === 'user' ? 'bg-blue-600/80 text-white' : 'bg-gray-800/80 text-gray-200'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && <div className="flex justify-start"><div className="bg-gray-800/80 p-2.5 rounded-2xl text-gray-400 animate-pulse">Pensando...</div></div>}
            <div ref={chatRef} />
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Preguntá..." className="flex-1 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/60" />
            <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-3 py-2 rounded-xl text-xs font-medium transition">Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
