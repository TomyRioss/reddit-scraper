'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface Post {
  id: string; subreddit: string; title: string; selftext: string;
  url: string; score: number; num_comments: number; created_utc: number;
  relevance: number; keywords_matched: string; ai_summary: string | null;
  ai_score: number | null; seen: number;
}
interface Stats { total: number; unread: number; withAi: number }
interface LogEntry { subreddit: string; posts_found: number; posts_new: number; posts_relevant: number; scraped_at: string }
interface SubItem { name: string; label: string; subscribers: number; last_scraped: string | null; lang: string }

function timeAgo(utc: number) {
  const diff = Date.now() / 1000 - utc;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Stars({ n }: { n: number }) {
  const full = Math.round(n / 2);
  return <span className="text-yellow-400 text-xs">{'⭐'.repeat(Math.max(0, Math.min(5, full)))}</span>;
}

function RelevanceBadge({ r }: { r: number }) {
  const color = r >= 80 ? 'bg-green-700' : r >= 40 ? 'bg-yellow-700' : r >= 20 ? 'bg-orange-700' : 'bg-gray-700';
  const stars = r >= 80 ? 5 : r >= 60 ? 4 : r >= 40 ? 3 : r >= 20 ? 2 : r >= 10 ? 1 : 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} text-white`}>
      {stars > 0 ? '⭐'.repeat(stars) : '—'}
      <span className="ml-1 opacity-60">{r}pts</span>
    </span>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, withAi: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [subreddits, setSubreddits] = useState<SubItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [scraping, setScraping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [rating, setRating] = useState(false);
  const [error, setError] = useState('');
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const [sortBy, setSortBy] = useState('relevance');
  const [searchTerm, setSearchTerm] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [ratings, setRatings] = useState<Record<string, { stars: number; explanation: string; tags: string[] }>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') {
      if (filter === 'unread') params.set('unread', 'true');
      else params.set('subreddit', filter);
    }
    params.set('limit', '200');
    const res = await fetch(`/api/offers?${params}`);
    const data = await res.json();
    setPosts(data.posts || []);
    setStats(data.stats || { total: 0, unread: 0, withAi: 0 });
    setLogs(data.logs || []);
    setSubreddits(data.subreddits || []);
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const startScrape = async () => {
    setScraping(true); setError(''); setScrapeResult(null);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      setScrapeResult(await res.json());
      loadData();
    } catch (e: any) { setError(e.message); }
    setScraping(false);
  };

  const startAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ all: true }) });
      const data = await res.json();
      alert(`✅ ${data.analyzed} posts analizados`);
      loadData();
    } catch (e: any) { setError(e.message); }
    setAnalyzing(false);
  };

  const ratePosts = async () => {
    setRating(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ rate: true }),
      });
      const data = await res.json();
      setScrapeResult({ rating: data });
      loadData();
    } catch (e: any) { setError(e.message); }
    setRating(false);
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatMsg };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatMsg('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newHistory.slice(-10) }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    }
    setChatLoading(false);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const markRead = async () => {
    await fetch('/api/offers', { method: 'PATCH', body: JSON.stringify({}) });
    loadData();
  };

  // Filtering & Sorting
  let filtered = [...posts];
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(t) || p.keywords_matched.toLowerCase().includes(t) || p.subreddit.includes(t)
    );
  }
  if (sortBy === 'relevance') filtered.sort((a, b) => b.relevance - a.relevance || b.created_utc - a.created_utc);
  else if (sortBy === 'newest') filtered.sort((a, b) => b.created_utc - a.created_utc);
  else if (sortBy === 'score') filtered.sort((a, b) => b.score - a.score);
  else if (sortBy === 'random') filtered.sort(() => Math.random() - 0.5);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* === TOP BAR === */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">🚀 <span className="hidden sm:inline">Freelance Offers</span></h1>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{stats.total} ofertas</span>
            {stats.unread > 0 && <span className="text-xs bg-green-800 text-green-200 px-2 py-0.5 rounded-full">{stats.unread} nuevas</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={startScrape} disabled={scraping}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-xs font-medium transition-all">
              {scraping ? '⏳' : '🔄'} Scrapear
            </button>
            <button onClick={ratePosts} disabled={rating || posts.length === 0}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs font-medium transition-all">
              {rating ? '⏳' : '⭐'} Calificar
            </button>
            <button onClick={() => setChatOpen(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-medium transition-all">
              🤖 Chat IA
            </button>
            <button onClick={markRead}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-all">
              ✅ Leído
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Error */}
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm">{error}</div>}
        {scrapeResult && !scrapeResult.rating && (
          <div className="mb-4 p-3 bg-gray-800/80 rounded-lg text-sm border border-gray-700">
            📊 <strong>{scrapeResult.totalFound}</strong> encontrados, <strong>{scrapeResult.totalSaved}</strong> nuevos
            {scrapeResult.errors?.length > 0 && <span className="text-red-400"> · {scrapeResult.errors.length} errores</span>}
          </div>
        )}
        {scrapeResult?.rating && (
          <div className="mb-4 p-3 bg-gray-800/80 rounded-lg text-sm border border-green-700">
            🤖 <strong>Calificación IA completada</strong><br/>
            <span className="text-green-400">✅ {scrapeResult.rating.good} ofertas buenas</span>
            {scrapeResult.rating.aggregator > 0 && <span className="text-red-400"> · 🗑️ {scrapeResult.rating.aggregator} agregadores/spam</span>}
            {scrapeResult.rating.fulltime > 0 && <span className="text-orange-400"> · 🚫 {scrapeResult.rating.fulltime} empleos fijos</span>}
            {scrapeResult.rating.filtered > 0 && <span className="text-gray-400"> · ⏭️ {scrapeResult.rating.filtered} otros filtrados</span>}
            <span className="text-gray-500"> · {scrapeResult.rating.total} total procesados</span>
          </div>
        )}

        {/* === FILTERS + SEARCH === */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar ofertas..." className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-blue-500" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
            <option value="relevance">Mejor ranking</option>
            <option value="newest">Más recientes</option>
            <option value="score">Más votados</option>
            <option value="random">Aleatorio</option>
          </select>
          <div className="flex gap-1 flex-wrap">
            {['all', 'unread', ...subreddits.map(s => s.name)].slice(0, 25).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {f === 'all' ? 'Todos' : f === 'unread' ? `Sin leer (${stats.unread})` : `r/${f}`}
              </button>
            ))}
          </div>
        </div>

        {/* === STATS ROW === */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-blue-400' },
            { label: 'Sin leer', value: stats.unread, color: 'text-green-400' },
            { label: 'Analizados IA', value: stats.withAi, color: 'text-purple-400' },
            { label: 'Subreddits', value: subreddits.length, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/80 border border-gray-800 rounded-xl p-3 text-center">
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* === OFFERS LIST === */}
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-16">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm">No hay ofertas. Scrapeá para empezar.</p>
            </div>
          )}
          {filtered.map(post => {
            const rating = ratings[post.id] || { stars: Math.round(post.relevance / 25), explanation: '', tags: post.keywords_matched.split(', ').slice(0, 5) };
            const isExpanded = expandedPost === post.id;
            return (
              <div key={post.id}
                onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                className={`group p-3 bg-gray-900/60 border ${isExpanded ? 'border-blue-700' : 'border-gray-800/80'} rounded-xl hover:border-gray-600 transition-all cursor-pointer ${post.seen ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Rating */}
                  <div className="shrink-0 w-10 text-center pt-0.5">
                    <div className="text-lg">{rating.stars > 0 ? '⭐'.repeat(Math.min(5, rating.stars)) : '—'}</div>
                    <div className="text-[10px] text-gray-600">{post.relevance}pts</div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">r/{post.subreddit}</span>
                      <span className="text-[10px] text-gray-500">{timeAgo(post.created_utc)}</span>
                      {!post.seen && <span className="text-[10px] bg-green-800 text-green-200 px-1.5 py-0.5 rounded-full">NUEVO</span>}
                      {post.score > 0 && <span className="text-[10px] text-orange-400">⬆ {post.score}</span>}
                    </div>
                    <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-blue-300 transition-colors">
                      {post.title}
                    </h3>
                    {isExpanded && rating.explanation && (
                      <p className="text-xs text-gray-400 mt-1.5 italic border-l-2 border-purple-700 pl-2">{rating.explanation}</p>
                    )}
                    {rating.tags && rating.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {rating.tags.slice(0, isExpanded ? 15 : 5).map(t => (
                          <span key={t} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-700">{t}</span>
                        ))}
                      </div>
                    )}
                    {isExpanded && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <a href={post.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/40 transition-colors">
                          🔗 Ver en Reddit
                        </a>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch('/api/analyze', {
                            method: 'POST', body: JSON.stringify({ postId: post.id })
                          });
                          const data = await res.json();
                          setRatings(prev => ({
                            ...prev,
                            [post.id]: {
                              stars: Math.round((data.relevanceScore || 0) / 2),
                              explanation: data.summary || '',
                              tags: data.skills || [],
                            }
                          }));
                        }}
                          className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg hover:bg-purple-600/40">
                          🤖 Analizar con IA
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrape Log */}
        {logs.length > 0 && (
          <details className="mt-8">
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">📋 Últimos scrapeos</summary>
            <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
              {logs.slice(0, 30).map((log, i) => (
                <div key={i} className="text-[10px] text-gray-600 font-mono">
                  [{log.scraped_at?.substring(11, 19)}] r/{log.subreddit}: {log.posts_found} encontrados
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* === CHAT OVERLAY === */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:w-[420px] h-[70vh] sm:h-[500px] flex flex-col shadow-2xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-800">
              <span className="text-sm font-medium">🤖 Asistente de Ofertas</span>
              <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-white text-lg">&times;</button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 text-xs py-8">
                  <p className="mb-2">Preguntame sobre las ofertas disponibles:</p>
                  <div className="space-y-1">
                    <button onClick={() => setChatMsg('¿Cuáles son las mejores ofertas freelance hoy?')}
                      className="block w-full text-left text-xs bg-gray-800 p-2 rounded-lg hover:bg-gray-700">¿Cuáles son las mejores ofertas freelance hoy?</button>
                    <button onClick={() => setChatMsg('Mostrame ofertas de React/Next.js')}
                      className="block w-full text-left text-xs bg-gray-800 p-2 rounded-lg hover:bg-gray-700">Mostrame ofertas de React/Next.js</button>
                    <button onClick={() => setChatMsg('Recomendame proyectos para un frontend developer')}
                      className="block w-full text-left text-xs bg-gray-800 p-2 rounded-lg hover:bg-gray-700">Recomendame proyectos para frontend developer</button>
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 p-2.5 rounded-2xl text-xs text-gray-400">
                    <span className="animate-pulse">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Preguntá sobre las ofertas..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
              <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-3 py-2 rounded-xl text-xs font-medium transition-all">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
