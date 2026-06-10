'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

interface Post { id:string; subreddit:string; title:string; selftext:string; url:string; score:number; num_comments:number; created_utc:number; relevance:number; keywords_matched:string; ai_summary:string|null; ai_score:number|null; seen:number; }
interface Stats { total:number; unread:number; withAi:number; }
interface Sub { name:string; label:string; subscribers:number; lang:string; }

function ago(u:number) { const d=Date.now()/1000-u; if(d<60)return'now';if(d<3600)return`${~~(d/60)}m`;if(d<86400)return`${~~(d/3600)}h`;return`${~~(d/86400)}d`; }

function Stars({n}:{n:number}) {
  const v=Math.round(n);
  return <span className="inline-flex gap-px">{[1,2,3,4,5].map(i=><svg key={i} className={`w-3 h-3 ${i<=v?'text-amber-400':'text-white/[0.07]'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</span>;
}

export default function Home() {
  const [posts,setPosts]=useState<Post[]>([]);
  const [stats,setStats]=useState<Stats>({total:0,unread:0,withAi:0});
  const [subs,setSubs]=useState<Sub[]>([]);
  const [sub,setSub]=useState('all');
  const [sort,setSort]=useState('stars');
  const [q,setQ]=useState('');
  const [minS,setMinS]=useState(0);
  const [msg,setMsg]=useState('');
  const [load,setLoad]=useState({s:false,r:false});
  const [done,setDone]=useState(false);
  const [chat,setChat]=useState(false);
  const [ct,setCt]=useState('');
  const [cm,setCm]=useState<{r:string;c:string}[]>([]);
  const [cl,setCl]=useState(false);
  const [open,setOpen]=useState<string|null>(null);
  const cr=useRef<HTMLDivElement>(null);

  const fetchData=useCallback(async()=>{
    const p=new URLSearchParams({limit:'300'});
    if(sub!=='all')p.set(sub==='unread'?'unread':'subreddit','true');
    try{const r=await fetch(`/api/offers?${p}`);const d=await r.json();setPosts(d.posts||[]);setStats(d.stats||{});setSubs(d.subreddits||[]);}catch{}
    setDone(true);
  },[sub]);
  useEffect(()=>{fetchData()},[fetchData]);

  const doScrape=async()=>{setLoad(l=>({...l,s:true}));setMsg('');const r=await fetch('/api/scrape',{method:'POST'});const d=await r.json();setMsg(`✅ ${d.totalSaved} new${d.errors?.length?` ⚠️ ${d.errors.length} errors`:''}`);setLoad(l=>({...l,s:false}));fetchData()};
  const doRate=async()=>{setLoad(l=>({...l,r:true}));setMsg('');const r=await fetch('/api/analyze',{method:'POST',body:JSON.stringify({rate:true})});const d=await r.json();setMsg(`⭐ ${d.good} good · ${d.aggregator+d.fulltime+d.filtered} filtered`);setLoad(l=>({...l,r:false}));fetchData()};
  const send=async()=>{if(!ct.trim()||cl)return;const h=[...cm,{r:'user',c:ct}];setCm(h);setCt('');setCl(true);try{const r=await fetch('/api/chat',{method:'POST',body:JSON.stringify({messages:h.slice(-8).map(m=>({role:m.r,content:m.c}))})});const d=await r.json();setCm(p=>[...p,{r:'assistant',c:d.reply}])}catch{setCm(p=>[...p,{r:'assistant',c:'error'}])}setCl(false)};
  useEffect(()=>{cr.current?.scrollIntoView({behavior:'smooth'})},[cm]);

  const stars=(p:Post)=>Math.round((p.ai_score??p.relevance)/2);

  let items=[...posts];
  if(q){const s=q.toLowerCase();items=items.filter(p=>p.title.toLowerCase().includes(s)||p.keywords_matched.toLowerCase().includes(s))}
  if(sort==='stars')items.sort((a,b)=>stars(b)-stars(a)||b.created_utc-a.created_utc);
  else if(sort==='new')items.sort((a,b)=>b.created_utc-a.created_utc);
  else items.sort((a,b)=>b.relevance-a.relevance);
  if(minS>0)items=items.filter(p=>stars(p)>=minS);

  const subList=['all','unread',...subs.map(s=>s.name)];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4ec] antialiased">
      <style jsx global>{`
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.04);border-radius:10px}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .ani{animation:fi 0.25s ease-out both}
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white/85">🚀 Freelance Offers</h1>
            <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full font-mono">{stats.total}</span>
            {stats.unread>0&&<span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">● {stats.unread}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={doScrape} disabled={load.s} className="px-3 py-1.5 text-xs font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-25 text-white rounded-lg transition-colors">{load.s?'⏳':'🔄'} Scrape</button>
            <button onClick={doRate} disabled={load.r} className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 disabled:opacity-25 text-white/70 border border-white/10 rounded-lg transition-colors">{load.r?'⏳':'⭐'} Rate</button>
            <button onClick={()=>setChat(true)} className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors">💬 AI</button>
          </div>
        </div>
        {msg&&<div className="max-w-5xl mx-auto px-5 pb-2.5 text-xs text-white/40">{msg}</div>}
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search offers..."
            className="w-36 md:w-48 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40"/>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50 focus:outline-none focus:border-indigo-500/40">
            <option value="stars">⭐ Best Rated</option>
            <option value="new">🕐 Newest</option>
            <option value="rel">📊 Relevance</option>
          </select>
          <select value={minS} onChange={e=>setMinS(Number(e.target.value))} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50 focus:outline-none focus:border-indigo-500/40">
            {[0,1,2,3,4].map(i=><option key={i} value={i}>⭐ Min {i}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {subList.slice(0,15).map(s=>
              <button key={s} onClick={()=>setSub(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${sub===s?'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30':'text-white/30 hover:text-white/60 border border-transparent'}`}>{s==='all'?'All':s==='unread'?'New':s.length>10?s.slice(0,9)+'…':s}</button>
            )}
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[{l:'Total',v:stats.total,c:'text-indigo-300'},{l:'Unread',v:stats.unread,c:'text-emerald-300'},{l:'AI Rated',v:stats.withAi,c:'text-amber-300'},{l:'Sources',v:subs.length,c:'text-rose-300'}].map((s,i)=>(
            <div key={s.l} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center ani" style={{animationDelay:`${i*50}ms`}}>
              <div className={`text-xl font-bold tabular-nums ${s.c}`}>{s.v}</div>
              <div className="text-[10px] text-white/25 uppercase tracking-widest mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* OFFERS */}
        <div className="space-y-2">
          {!done?Array.from({length:4}).map((_,i)=>(
            <div key={i} className="bg-white/[0.015] border border-white/[0.04] rounded-xl p-4 ani" style={{animationDelay:`${i*40}ms`}}>
              <div className="flex gap-3">
                <div className="w-12 h-4 bg-white/5 rounded shrink-0"/>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded w-24"/>
                  <div className="h-4 bg-white/5 rounded w-full"/>
                  <div className="h-3 bg-white/5 rounded w-3/4"/>
                </div>
              </div>
            </div>
          )):items.length===0?(
            <div className="text-center py-24 ani">
              <div className="text-4xl mb-4 opacity-20">🔍</div>
              <p className="text-sm text-white/30 mb-1">No offers found</p>
              <p className="text-xs text-white/15 mb-6">Scrape some subreddits to find freelance programming work.</p>
              <button onClick={doScrape} disabled={load.s} className="px-4 py-2 text-sm font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-25 text-white rounded-lg transition-colors">{load.s?'Scraping…':'Start Scraping'}</button>
            </div>
          ):items.map((post,i)=>{
            const st=stars(post);const tags=post.keywords_matched?.split(', ').filter(Boolean).slice(0,7);const op=open===post.id;
            return(
              <div key={post.id} onClick={()=>setOpen(op?null:post.id)}
                className={`border rounded-xl transition-all cursor-pointer ani ${
                  op?'bg-white/[0.04] border-indigo-500/25':'bg-white/[0.015] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                } ${!post.seen?'border-l-[3px] border-l-indigo-500':''} ${post.seen?'opacity-30 hover:opacity-60':''}`}
                style={{animationDelay:`${Math.min(i*15,250)}ms`,padding:'11px 14px'}}>
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-center pt-0.5"><Stars n={st}/><div className="text-[8px] text-white/15 font-mono mt-1">{post.relevance}pts</div></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-mono text-indigo-400/60 bg-indigo-500/10 px-1.5 py-0.5 rounded">r/{post.subreddit}</span>
                      <span className="text-[10px] text-white/25">{ago(post.created_utc)}</span>
                      {!post.seen&&<span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">● new</span>}
                      {post.score>0&&<span className="text-[10px] text-rose-400/50">▲{post.score}</span>}
                    </div>
                    <h3 className="text-sm font-medium leading-snug">{post.title}</h3>
                    {op&&post.ai_summary&&<p className="text-xs text-white/40 mt-2 leading-relaxed bg-white/[0.02] rounded-lg px-3 py-2 border-l-2 border-amber-500/20">{post.ai_summary}</p>}
                    {op&&<a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 mt-3 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">🔗 Open on Reddit</a>}
                    {tags.length>0&&<div className="flex gap-1 mt-2 flex-wrap">{tags.map(t=><span key={t} className="text-[9px] text-white/20 bg-white/[0.02] px-2 py-0.5 rounded-full border border-white/[0.05]">{t}</span>)}</div>}
                  </div>
                  <div className="text-xs text-white/15 pt-1 shrink-0">{op?'▲':'▼'}</div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-12 pb-8 text-center text-[9px] text-white/10 font-mono">reddit-scraper · {items.length} offers</footer>
      </main>

      {/* CHAT */}
      {chat&&(
        <div onClick={()=>setChat(false)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div onClick={e=>e.stopPropagation()} className="bg-[#0e0e16] border border-white/[0.06] rounded-t-2xl sm:rounded-2xl w-full sm:w-[380px] h-[70vh] sm:h-[520px] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"><span className="text-sm font-medium flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>AI Assistant</span><button onClick={()=>setChat(false)} className="text-white/30 hover:text-white/60 text-lg">&times;</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {cm.length===0?(
                <div className="text-white/20 text-center py-8 space-y-2">
                  <p className="text-xs mb-3">Ask about offers.</p>
                  {['Best offers today?','React/Next.js projects?','Backend opportunities?'].map(q=>(
                    <button key={q} onClick={()=>setCt(q)} className="block w-full text-left text-xs bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-xl text-white/40 transition-colors border border-white/[0.04]">{q}</button>
                  ))}
                </div>
              ):cm.map((m,i)=>(
                <div key={i} className={`flex ${m.r==='user'?'justify-end':'justify-start'} ani`}>
                  <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl leading-relaxed ${m.r==='user'?'bg-indigo-500/15 text-indigo-200 border border-indigo-500/15':'bg-white/[0.04] text-white/50'}`}>{m.c}</div>
                </div>
              ))}
              {cl&&<div className="flex justify-start"><div className="bg-white/[0.04] px-3 py-2.5 rounded-2xl flex gap-1.5">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"/>)}</div></div>}
              <div ref={cr}/>
            </div>
            <div className="p-4 border-t border-white/[0.06] flex gap-2">
              <input value={ct} onChange={e=>setCt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask…" className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 transition-colors"/>
              <button onClick={send} disabled={cl||!ct.trim()} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-20 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
