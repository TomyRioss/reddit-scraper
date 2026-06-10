'use client';

import { useEffect, useState, useCallback } from 'react';

interface Post {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: number;
  relevance: number;
  keywords_matched: string;
  ai_summary: string | null;
  ai_score: number | null;
  seen: number;
}

interface Stats { total: number; unread: number; withAi: number }
interface LogEntry { subreddit: string; posts_found: number; posts_new: number; posts_relevant: number; scraped_at: string }
interface SubItem { name: string; label: string; subscribers: number; last_scraped: string | null }

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, withAi: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [subreddits, setSubreddits] = useState<SubItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [scraping, setScraping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [scrapeResult, setScrapeResult] = useState<any>(null);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') { params.set('subreddit', filter); params.set('unread', 'true'); }
    if (filter === 'unread') params.set('unread', 'true');
    const res = await fetch(`/api/offers?${params}`);
    const data = await res.json();
    setPosts(data.posts || []);
    setStats(data.stats || { total: 0, unread: 0, withAi: 0 });
    setLogs(data.logs || []);
    setSubreddits(data.subreddits || []);
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const startScrape = async () => {
    setScraping(true);
    setError('');
    setScrapeResult(null);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      setScrapeResult(data);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
    setScraping(false);
  };

  const startAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ all: true }) });
      const data = await res.json();
      alert(`✅ ${data.analyzed} posts analizados con IA`);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
    setAnalyzing(false);
  };

  const markRead = async () => {
    await fetch('/api/offers', { method: 'PATCH', body: JSON.stringify({}) });
    loadData();
  };

  const timeAgo = (utc: number) => {
    const diff = Date.now() / 1000 - utc;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const relevanceColor = (r: number) => {
    if (r >= 20) return 'text-green-400';
    if (r >= 10) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">🚀 Reddit Freelance Scraper</h1>
            <p className="text-sm text-gray-400">
              {stats.total} posts · {stats.unread} sin leer · {stats.withAi} analizados con IA
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={startScrape} disabled={scraping}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm font-medium">
              {scraping ? '⏳ Scrapeando...' : '🔄 Scrapear'}
            </button>
            <button onClick={startAnalysis} disabled={analyzing || posts.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-sm font-medium">
              {analyzing ? '🤖 Analizando...' : '🤖 Analizar con IA'}
            </button>
            <button onClick={markRead}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium">
              ✅ Marcar leído
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm">{error}</div>}

        {scrapeResult && (
          <div className="mb-4 p-3 bg-gray-800 rounded text-sm">
            <strong>📊 Scrapeo completado:</strong>{' '}
            {scrapeResult.totalFound} encontrados, {scrapeResult.totalSaved} nuevos, {scrapeResult.totalRelevant} relevantes
            {scrapeResult.errors?.length > 0 && (
              <span className="text-red-400"> · {scrapeResult.errors.length} errores</span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-xs ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
            Todos
          </button>
          <button onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded text-xs ${filter === 'unread' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
            Sin leer ({stats.unread})
          </button>
          {subreddits.map(s => (
            <button key={s.name} onClick={() => setFilter(s.name)}
              className={`px-3 py-1 rounded text-xs ${filter === s.name ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              r/{s.name}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-2">
          {posts.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              No hay ofertas aún. Hacé click en "Scrapear" para buscar.
            </div>
          )}
          {posts.map(post => (
            <div key={post.id} className={`p-4 bg-gray-900/80 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors ${post.seen ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-blue-400 font-mono">r/{post.subreddit}</span>
                    <span className={`text-xs font-mono ${relevanceColor(post.relevance)}`}>
                      [{post.relevance}pts]
                    </span>
                    {!post.seen && <span className="text-xs bg-green-700 px-1.5 py-0.5 rounded">NUEVO</span>}
                    <span className="text-xs text-gray-500">{timeAgo(post.created_utc)}</span>
                  </div>
                  <a href={post.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium hover:text-blue-400 line-clamp-2">
                    {post.title}
                  </a>
                  {post.ai_summary && (
                    <p className="text-xs text-gray-400 mt-1 italic">{post.ai_summary}</p>
                  )}
                  {post.keywords_matched && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {post.keywords_matched.split(', ').map(k => (
                        <span key={k} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0">
                  <div>⬆️ {post.score}</div>
                  <div>💬 {post.num_comments}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scrape Log */}
        {logs.length > 0 && (
          <details className="mt-8">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300">
              📋 Últimos scrapeos
            </summary>
            <div className="mt-2 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-xs text-gray-500 font-mono">
                  [{log.scraped_at}] r/{log.subreddit}: {log.posts_found} encontrados, {log.posts_new} nuevos, {log.posts_relevant} relevantes
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
