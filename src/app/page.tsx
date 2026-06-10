'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

interface Post { id:string; subreddit:string; title:string; selftext:string; url:string; score:number; num_comments:number; created_utc:number; relevance:number; keywords_matched:string; ai_summary:string|null; ai_score:number|null; seen:number; }
interface Stats { total:number; unread:number; withAi:number; }
interface Sub { name:string; label:string; subscribers:number; lang:string; }

function ago(u:number) {
  const d=Date.now()/1000-u;
  if(d<60)return'just now';if(d<3600)return`${Math.floor(d/60)}m ago`;
  if(d<86400)return`${Math.floor(d/3600)}h ago`;return`${Math.floor(d/86400)}d ago`;
}

function Stars({n}:{n:number}) {
  const v=Math.round(n);
  return(
    <div className="inline-flex gap-[1px]" aria-label={`${v} out of 5 stars`}>
      {[1,2,3,4,5].map(i=>(
        <svg key={i} className={`w-3 h-3 ${i<=v?'text-amber-400':'text-white/8'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

function Skeleton({i}:{i:number}) {
  return(
    <div className="rounded-2xl border border-white/[0.04] bg-bg-card/30 p-4 anim-up-sm" style={{animationDelay:`${i*30}ms`}}>
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0"><div className="shimmer h-4 w-10 rounded mx-auto"/></div>
        <div className="flex-1 space-y-2">
          <div className="shimmer h-3 w-24 rounded-full"/>
          <div className="shimmer h-4 w-full rounded-lg"/>
          <div className="shimmer h-3 w-3/4 rounded-lg"/>
        </div>
      </div>
    </div>
  );
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
  const [load,setLoad]=useState({s:false,a:false,init:true});
  const [chat,setChat]=useState(false);
  const [chatT,setChatT]=useState('');
  const [chatM,setChatM]=useState<{role:string;content:string}[]>([]);
  const [chatL,setChatL]=useState(false);
  const [open,setOpen]=useState<string|null>(null);
  const [scrapeLog,setScrapeLog]=useState<any[]>([]);
  const ref=useRef<HTMLDivElement>(null);

  const loadData=useCallback(async()=>{
    const p=new URLSearchParams({limit:'300'});
    if(sub!=='all')p.set(sub==='unread'?'unread':'subreddit','true');
    try{
      const r=await fetch(`/api/offers?${p}`);const d=await r.json();
      setPosts(d.posts||[]);setStats(d.stats||{});setSubs(d.subreddits||[]);setScrapeLog(d.logs||[]);
    }catch(e){console.error(e)}
    setLoad(l=>({...l,init:false}));
  },[sub]);
  useEffect(()=>{loadData()},[loadData]);

  const scrape=async()=>{
    setLoad(l=>({...l,s:true}));setMsg('');
    const r=await fetch('/api/scrape',{method:'POST'});const d=await r.json();
    setMsg(`<span class="text-emerald-400">●</span> scraped <strong>${d.totalSaved}</strong> new offers${d.errors?.length?`<span class="text-white/30"> · ${d.errors.length} errors</span>`:''}`);
    setLoad(l=>({...l,s:false}));loadData();
  };
  const rate=async()=>{
    setLoad(l=>({...l,a:true}));setMsg('');
    const r=await fetch('/api/analyze',{method:'POST',body:JSON.stringify({rate:true})});const d=await r.json();
    setMsg(`<span class="text-amber-400">●</span> rated: <strong>${d.good}</strong> good <span class="text-white/30">· ${d.aggregator+d.fulltime+d.filtered} filtered</span>`);
    setLoad(l=>({...l,a:false}));loadData();
  };
  const send=async()=>{
    if(!chatT.trim()||chatL)return;
    const h=[...chatM,{role:'user',content:chatT}];setChatM(h);setChatT('');setChatL(true);
    try{const r=await fetch('/api/chat',{method:'POST',body:JSON.stringify({messages:h.slice(-8)})});const d=await r.json();setChatM(p=>[...p,{role:'assistant',content:d.reply}])}
    catch{setChatM(p=>[...p,{role:'assistant',content:'connection error'}])}
    setChatL(false);
  };
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth'})},[chatM]);

  const stars=(p:Post)=>Math.round((p.ai_score??p.relevance)/2);

  let fi=[...posts];
  if(q){const s=q.toLowerCase();fi=fi.filter(p=>p.title.toLowerCase().includes(s)||p.keywords_matched.toLowerCase().includes(s))}
  if(sort==='stars')fi.sort((a,b)=>stars(b)-stars(a)||b.created_utc-a.created_utc);
  else if(sort==='new')fi.sort((a,b)=>b.created_utc-a.created_utc);
  else if(sort==='rel')fi.sort((a,b)=>b.relevance-a.relevance);
  if(minS>0)fi=fi.filter(p=>stars(p)>=minS);

  const subsList=['all','unread',...subs.map(s=>s.name)];

  return(
    <div className="min-h-screen selection:bg-accent/30 selection:text-white">
      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-40 bg-bg/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🚀</span>
              <h1 className="text-sm font-semibold tracking-tight">offers</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono bg-white/5 text-white/35 px-2 py-0.5 rounded-full">{stats.total}</span>
              {stats.unread>0&&<span className="text-[10px] font-medium bg-emerald-500/12 text-emerald-400 px-2 py-0.5 rounded-full animate-up-sm">● {stats.unread} new</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={scrape} disabled={load.s}
              className="px-3 py-1.5 text-[11px] font-medium bg-accent hover:bg-[#5558e6] disabled:opacity-25 text-white rounded-lg transition-all active:scale-[0.96]">
              {load.s?<span className="inline-flex gap-1"><span className="pulse-dot">●</span><span className="pulse-dot" style={{animationDelay:'0.2s'}}>●</span><span className="pulse-dot" style={{animationDelay:'0.4s'}}>●</span></span>:'🔄 Scrape'}
            </button>
            <button onClick={rate} disabled={load.a}
              className="px-3 py-1.5 text-[11px] font-medium bg-[#1a1a2e] hover:bg-[#222242] border border-white/8 disabled:opacity-25 text-white/80 rounded-lg transition-all active:scale-[0.96]">
              {load.a?'⏳':'⭐ Rate'}
            </button>
            <button onClick={()=>setChat(true)}
              className="px-3 py-1.5 text-[11px] font-medium bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white rounded-lg transition-all active:scale-[0.96]">
              💬 AI
            </button>
          </div>
        </div>
        {msg&&<div className="max-w-4xl mx-auto px-5 pb-2.5 text-xs text-white/40 leading-relaxed" dangerouslySetInnerHTML={{__html:msg}}/>}
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-5">
        {/* ─── FILTERS ─── */}
        <section className="flex flex-wrap items-center gap-2 mb-5 anim-up-sm">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search offers..."
              className="w-40 md:w-52 bg-white/[0.03] border border-white/8 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-accent/40 transition-colors"/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white/55 focus:outline-none focus:border-accent/40 appearance-none cursor-pointer">
            <option value="stars">⭐ Best Rated</option>
            <option value="new">🕐 Newest</option>
            <option value="rel">📊 Relevance</option>
          </select>
          <select value={minS} onChange={e=>setMinS(Number(e.target.value))}
            className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white/55 focus:outline-none focus:border-accent/40 appearance-none cursor-pointer">
            {[0,1,2,3,4].map(i=><option key={i} value={i}>⭐ Min {i}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {subsList.slice(0,12).map(s=>
              <button key={s} onClick={()=>setSub(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  sub===s?'bg-accent/15 text-[#a5a8ff] border border-accent/25':'text-white/30 hover:text-white/60 border border-transparent'
                }`}>{s==='all'?'All':s==='unread'?'New':s.length>8?s.slice(0,7)+'…':s}</button>
            )}
          </div>
        </section>

        {/* ─── STATS ─── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {l:'Total',v:stats.total,c:'from-indigo-500/10 to-indigo-500/5 border-indigo-500/10',tc:'text-indigo-300'},
            {l:'Unread',v:stats.unread,c:'from-emerald-500/10 to-emerald-500/5 border-emerald-500/10',tc:'text-emerald-300'},
            {l:'AI Rated',v:stats.withAi,c:'from-amber-500/10 to-amber-500/5 border-amber-500/10',tc:'text-amber-300'},
            {l:'Sources',v:subs.length,c:'from-rose-500/10 to-rose-500/5 border-rose-500/10',tc:'text-rose-300'},
          ].map((s,i)=>(
            <div key={s.l} className="rounded-2xl bg-gradient-to-br p-4 border text-center anim-up-sm" style={{animationDelay:`${i*50}ms`}}>
              <div className={`text-xl font-bold tabular-nums ${s.tc}`}>{s.v}</div>
              <div className="text-[10px] text-white/25 uppercase tracking-widest mt-1">{s.l}</div>
            </div>
          ))}
        </section>

        {/* ─── OFFERS ─── */}
        <section className="space-y-2">
          {load.init?(
            // Loading skeleton
            Array.from({length:6}).map((_,i)=><Skeleton key={i} i={i}/>)
          ):fi.length===0?(
            // Empty state
            <div className="text-center py-24 anim-up">
              <div className="text-4xl mb-4 opacity-30">🔍</div>
              <h2 className="text-sm font-medium text-white/30 mb-2">No offers yet</h2>
              <p className="text-xs text-white/15 mb-6">Scrape Reddit subreddits to find freelance programming opportunities.</p>
              <button onClick={scrape} disabled={load.s}
                className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-25 text-white rounded-xl transition-all active:scale-[0.96]">
                {load.s?'Scraping…':'Start Scraping'}
              </button>
              {scrapeLog.length>0&&(
                <div className="mt-8 text-left max-w-xs mx-auto">
                  <p className="text-[10px] text-white/15 uppercase tracking-wider mb-2">Last scrapes</p>
                  <div className="space-y-1">
                    {scrapeLog.slice(0,8).map((l:any,i)=>(
                      <div key={i} className="text-[10px] font-mono text-white/10 truncate">
                        r/{l.subreddit} · {l.posts_found} found
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ):fi.map((post,i)=>{
            const st=stars(post);const tags=post.keywords_matched?.split(', ').filter(Boolean).slice(0,8);const op=open===post.id;
            return(
              <article key={post.id} onClick={()=>setOpen(op?null:post.id)}
                className={`rounded-2xl border transition-all cursor-pointer anim-up-sm ${
                  op?'bg-gradient-to-br from-bg-card/80 to-bg-card/50 border-accent/25 shadow-[0_0_30px_-5px_rgba(99,102,241,0.08)]':'bg-bg-elevated/50 border-white/[0.05] hover:border-white/[0.1] hover:bg-bg-elevated/80'
                } ${!post.seen?'border-l-[3px] border-l-accent':''} ${post.seen?'opacity-30 hover:opacity-60':''}`}
                style={{animationDelay:`${Math.min(i*20,300)}ms`,padding:'13px 15px'}}>
                <div className="flex items-start gap-3">
                  {/* Stars column */}
                  <div className="w-14 shrink-0 text-center pt-0.5">
                    <Stars n={st}/>
                    <div className="text-[8px] text-white/15 font-mono mt-1">{post.relevance}pts</div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-indigo-400/60 bg-accent-soft px-1.5 py-0.5 rounded-md">r/{post.subreddit}</span>
                      <span className="text-[10px] text-white/25">{ago(post.created_utc)}</span>
                      {!post.seen&&<span className="text-[9px] font-medium bg-emerald-500/12 text-emerald-400/80 px-1.5 py-0.5 rounded-full">● new</span>}
                      {post.score>0&&<span className="text-[10px] text-rose-400/50">▲{post.score}</span>}
                      {post.num_comments>0&&<span className="text-[10px] text-white/20">💬{post.num_comments}</span>}
                    </div>
                    <h3 className="text-sm font-medium leading-snug mb-0.5">{post.title}</h3>
                    {op&&post.ai_summary&&(
                      <p className="text-xs text-white/40 mt-2 leading-relaxed italic bg-white/[0.02] rounded-lg p-2.5 border-l-2 border-amber-500/20">
                        {post.ai_summary}
                      </p>
                    )}
                    {op&&(
                      <div className="flex gap-2 mt-3">
                        <a href={post.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] bg-white/5 hover:bg-white/10 text-white/50 px-3 py-1.5 rounded-lg transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                          Open on Reddit
                        </a>
                      </div>
                    )}
                    {tags.length>0&&(
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {tags.slice(0,op?12:5).map(t=>
                          <span key={t} className="text-[9px] bg-white/[0.02] text-white/20 px-2 py-0.5 rounded-full border border-white/[0.05]">{t}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white/15 pt-1 shrink-0">{op?'▲':'▼'}</div>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="mt-12 pb-8 text-center text-[9px] text-white/8 font-mono tracking-wider">
          reddit-scraper · {fi.length} offers · deepseek v4 flash
        </footer>
      </main>

      {/* ─── CHAT ─── */}
      {chat&&(
        <div onClick={()=>setChat(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div onClick={e=>e.stopPropagation()}
            className="bg-bg-elevated border border-white/[0.06] rounded-t-2xl sm:rounded-2xl w-full sm:w-[400px] h-[70vh] sm:h-[540px] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
              <span className="text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                AI Assistant
              </span>
              <button onClick={()=>setChat(false)} className="text-white/20 hover:text-white/50 text-lg leading-none transition-colors">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatM.length===0?(
                <div className="text-white/20 text-center py-8 space-y-3">
                  <p className="text-xs mb-4">Ask me about available freelance offers.</p>
                  {[
                    'What are the best offers today?',
                    'Show me React / Next.js projects',
                    'Recommend backend opportunities',
                    'Full-stack offers with good budget',
                  ].map(q=>(
                    <button key={q} onClick={()=>setChatT(q)}
                      className="block w-full text-left text-xs bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-xl text-white/40 transition-colors border border-white/[0.04]">
                      {q}
                    </button>
                  ))}
                </div>
              ):chatM.map((m,i)=>(
                <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'} anim-up-sm`}>
                  <div className={`max-w-[88%] p-3 rounded-2xl text-sm leading-relaxed ${
                    m.role==='user'
                      ?'bg-accent/15 text-indigo-200 border border-accent/15'
                      :'bg-white/[0.04] text-white/60 border border-white/[0.04]'
                  }`}>{m.content}</div>
                </div>
              ))}
              {chatL&&(
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] p-3 rounded-2xl flex gap-1.5">
                    {[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 pulse-dot" style={{animationDelay:`${i*0.2}s`}}/>)}
                  </div>
                </div>
              )}
              <div ref={ref}/>
            </div>
            <div className="p-4 border-t border-white/[0.05]">
              <div className="flex gap-2">
                <input value={chatT} onChange={e=>setChatT(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
                  placeholder="Type your question…"
                  className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/60 placeholder:text-white/20 focus:outline-none focus:border-accent/40 transition-colors"/>
                <button onClick={send} disabled={chatL||!chatT.trim()}
                  className="bg-accent hover:bg-accent-hover disabled:opacity-20 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.96] text-white">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
