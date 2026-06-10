'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

interface Post { id:string; subreddit:string; title:string; selftext:string; url:string; score:number; num_comments:number; created_utc:number; relevance:number; keywords_matched:string; ai_summary:string|null; ai_score:number|null; seen:number; }
interface Stats { total:number; unread:number; withAi:number; }
interface Sub { name:string; label:string; subscribers:number; lang:string; }

function ago(u:number) { const d=Date.now()/1000-u; if(d<60) return 'now'; if(d<3600) return `${Math.floor(d/60)}m`; if(d<86400) return `${Math.floor(d/3600)}h`; return `${Math.floor(d/86400)}d`; }

function Stars({n}:{n:number}) {
  const v=Math.round(n);
  return <div className="inline-flex gap-0.5">{[1,2,3,4,5].map(i=><svg key={i} className={`w-3 h-3 ${i<=v?'text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.3)]':'text-white/10'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</div>;
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
  const [load,setLoad]=useState({s:false,a:false});
  const [chat,setChat]=useState(false);
  const [chatT,setChatT]=useState('');
  const [chatM,setChatM]=useState<{role:string;content:string}[]>([]);
  const [chatL,setChatL]=useState(false);
  const [open,setOpen]=useState<string|null>(null);
  const ref=useRef<HTMLDivElement>(null);

  const loadData=useCallback(async()=>{
    const p=new URLSearchParams({limit:'300'});
    if(sub!=='all') p.set(sub==='unread'?'unread':'subreddit','true');
    const r=await fetch(`/api/offers?${p}`);const d=await r.json();
    setPosts(d.posts||[]);setStats(d.stats||{});setSubs(d.subreddits||[]);
  },[sub]);
  useEffect(()=>{loadData()},[loadData]);

  const scrape=async()=>{setLoad(p=>({...p,s:true}));setMsg('');const r=await fetch('/api/scrape',{method:'POST'});const d=await r.json();setMsg(`📥 ${d.totalSaved} new${d.errors?.length?` · ⚠️ ${d.errors.length} errors`:''}`);setLoad(p=>({...p,s:false}));loadData()};
  const rate=async()=>{setLoad(p=>({...p,a:true}));setMsg('');const r=await fetch('/api/analyze',{method:'POST',body:JSON.stringify({rate:true})});const d=await r.json();setMsg(`🤖 ${d.good} good · 🗑️ ${d.aggregator+d.fulltime+d.filtered} filtered`);setLoad(p=>({...p,a:false}));loadData()};
  const send=async()=>{if(!chatT.trim()||chatL)return;const h=[...chatM,{role:'user',content:chatT}];setChatM(h);setChatT('');setChatL(true);try{const r=await fetch('/api/chat',{method:'POST',body:JSON.stringify({messages:h.slice(-8)})});const d=await r.json();setChatM(p=>[...p,{role:'assistant',content:d.reply}])}catch{setChatM(p=>[...p,{role:'assistant',content:'connection error'}])}setChatL(false)};
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth'})},[chatM]);

  const stars=(p:Post)=>Math.round((p.ai_score??p.relevance)/2);

  let fi=[...posts];
  if(q){const s=q.toLowerCase();fi=fi.filter(p=>p.title.toLowerCase().includes(s)||p.keywords_matched.toLowerCase().includes(s))}
  if(sort==='stars') fi.sort((a,b)=>stars(b)-stars(a)||b.created_utc-a.created_utc);
  else if(sort==='new') fi.sort((a,b)=>b.created_utc-a.created_utc);
  else if(sort==='rel') fi.sort((a,b)=>b.relevance-a.relevance);
  if(minS>0) fi=fi.filter(p=>stars(p)>=minS);

  const subsList=['all','unread',...subs.map(s=>s.name)];

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h1 className="text-sm font-semibold tracking-tight text-white/85">offers</h1>
            <span className="text-[11px] bg-white/5 text-white/35 px-2 py-0.5 rounded-full font-mono">{stats.total}</span>
            {stats.unread>0&&<span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{stats.unread} new</span>}
          </div>
          <div className="flex gap-1.5">
            <button onClick={scrape} disabled={load.s} className="px-2.5 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-30 rounded-lg text-[11px] font-medium transition-all active:scale-[0.96] text-white">{load.s?'⏳':'🔄'} Scrape</button>
            <button onClick={rate} disabled={load.a} className="px-2.5 py-1.5 bg-amber hover:bg-amber/80 disabled:opacity-30 rounded-lg text-[11px] font-medium transition-all active:scale-[0.96] text-white">{load.a?'⏳':'⭐'} Rate</button>
            <button onClick={()=>setChat(true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-[0.96] text-white" style={{background:'linear-gradient(135deg,#8b5cf6,#6d28d9)'}}>💬 AI</button>
          </div>
        </div>
        {msg&&<div className="max-w-3xl mx-auto px-4 pb-2 text-[11px] text-white/40">{msg}</div>}
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/15 text-[11px]">🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="search..." className="w-36 bg-white/4 border border-white/8 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-white/4 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-white/60 focus:outline-none">
            <option value="stars">⭐ best rated</option>
            <option value="new">🕐 newest</option>
            <option value="rel">📊 relevance</option>
          </select>
          <select value={minS} onChange={e=>setMinS(Number(e.target.value))} className="bg-white/4 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-white/60 focus:outline-none">
            {[0,1,2,3,4].map(i=><option key={i} value={i}>⭐ ≥{i}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {subsList.map(s=>
              <button key={s} onClick={()=>setSub(s)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${sub===s?'bg-accent/15 text-[#a5a8ff] border-accent/30':'text-white/30 hover:text-white/60 border-transparent'}`}>
                {s==='all'?'All':s==='unread'?'New':s}
              </button>
            )}
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          {[
            {l:'total',v:stats.total,c:'text-indigo-300'},
            {l:'unread',v:stats.unread,c:'text-emerald-300'},
            {l:'rated',v:stats.withAi,c:'text-amber-300'},
            {l:'sources',v:subs.length,c:'text-rose-300'},
          ].map((s,i)=>
            <div key={s.l} className="animate-fade bg-white/[0.02] border border-border rounded-2xl p-3 text-center" style={{animationDelay:`${i*60}ms`}}>
              <div className={`text-lg font-bold tabular-nums ${s.c}`}>{s.v}</div>
              <div className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">{s.l}</div>
            </div>
          )}
        </div>

        {/* OFFERS */}
        <div className="space-y-2">
          {fi.length===0?(
            <div className="text-center py-20 text-white/15">
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-xs">no offers yet. scrape some subreddits.</p>
            </div>
          ):fi.map((post,i)=>{
            const st=stars(post);const tags=post.keywords_matched?.split(', ').filter(Boolean).slice(0,8);const op=open===post.id;
            return (
              <div key={post.id} onClick={()=>setOpen(op?null:post.id)}
                className={`animate-fade rounded-2xl border cursor-pointer transition-all ${
                  op?'border-accent/30 bg-white/[0.03]':'border-border bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.025]'
                } ${!post.seen?'border-l-2 border-l-emerald-500/40':''} ${post.seen?'opacity-30 hover:opacity-60':''}`}
                style={{animationDelay:`${Math.min(i*15,250)}ms`,padding:'10px 13px'}}>
                <div className="flex items-start gap-2.5">
                  <div className="w-12 shrink-0 text-center pt-0.5">
                    <Stars n={st}/>
                    <div className="text-[8px] text-white/15 font-mono mt-1">{post.relevance}pts</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-mono text-indigo-400/70 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">r/{post.subreddit}</span>
                      <span className="text-[10px] text-white/25">{ago(post.created_utc)}</span>
                      {!post.seen&&<span className="text-[9px] bg-emerald-500/15 text-emerald-400/80 px-1.5 py-0.5 rounded-full font-medium">new</span>}
                      {post.score>0&&<span className="text-[10px] text-rose-400/50">▲{post.score}</span>}
                    </div>
                    <h3 className="text-sm font-medium leading-snug text-white/85 line-clamp-2 group-hover:text-indigo-300 transition-colors">{post.title}</h3>
                    {op&&post.ai_summary&&<p className="text-xs text-white/35 mt-1.5 italic leading-relaxed border-l-2 border-amber-500/25 pl-2.5">{post.ai_summary}</p>}
                    {op&&<div className="flex gap-2 mt-2"><a href={post.url} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-white/5 hover:bg-white/10 text-white/50 px-2.5 py-1 rounded-lg transition-colors">🔗 open on reddit</a></div>}
                    {tags.length>0&&<div className="flex gap-1 mt-1.5 flex-wrap">{tags.slice(0,op?12:5).map(t=><span key={t} className="text-[9px] bg-white/[0.03] text-white/25 px-1.5 py-0.5 rounded-full border border-white/[0.06]">{t}</span>)}</div>}
                  </div>
                  <div className="text-xs text-white/15 pt-1 shrink-0">{op?'▲':'▼'}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center text-[9px] text-white/10 font-mono">reddit-scraper · {fi.length} offers · deepseek v4 flash</div>
      </div>

      {/* CHAT */}
      {chat&&(
        <div onClick={()=>setChat(false)} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div onClick={e=>e.stopPropagation()} className="bg-[#0c0c16] border border-white/[0.06] rounded-t-2xl sm:rounded-2xl w-full sm:w-[380px] h-[70vh] sm:h-[520px] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-sm font-medium text-white/70">🤖 assistant</span>
              <button onClick={()=>setChat(false)} className="text-white/30 hover:text-white/60 text-lg">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
              {chatM.length===0?(
                <div className="text-white/20 text-center py-8 space-y-2">
                  <p className="text-xs">ask me about offers.</p>
                  {['Show React/Next.js offers','Best freelance projects','Backend opportunities'].map(q=>(
                    <button key={q} onClick={()=>setChatT(q)} className="block w-full text-left text-xs bg-white/5 p-2.5 rounded-xl hover:bg-white/10 text-white/40 transition-colors">{q}</button>
                  ))}
                </div>
              ):chatM.map((m,i)=>(
                <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'} animate-fade`}>
                  <div className={`max-w-[88%] p-2.5 rounded-2xl text-xs leading-relaxed ${m.role==='user'?'bg-accent/20 text-indigo-200 border border-accent/20':'bg-white/5 text-white/60'}`}>{m.content}</div>
                </div>
              ))}
              {chatL&&<div className="flex justify-start"><div className="bg-white/5 p-3 rounded-2xl text-xs text-white/30"><span className="thinking-dot">●</span> <span className="thinking-dot" style={{animationDelay:'0.3s'}}>●</span> <span className="thinking-dot" style={{animationDelay:'0.6s'}}>●</span></div></div>}
              <div ref={ref}/>
            </div>
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
              <input value={chatT} onChange={e=>setChatT(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="ask about offers..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 placeholder-white/20 focus:outline-none focus:border-white/20"/>
              <button onClick={send} disabled={chatL||!chatT.trim()} className="bg-violet-500/80 hover:bg-violet-400 disabled:opacity-30 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 text-white">send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
