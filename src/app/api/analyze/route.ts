import { getPosts, updateAiSummary, initDb } from '@/lib/db';
import { analyzePost, rateOffer } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await initDb();
  const { postId, all, rate } = await req.json();

  // Rate offers with smart filtering
  if (rate) {
    const posts = await getPosts({ unreadOnly: false, limit: 200 });
    let rated = { good: 0, filtered: 0, aggregator: 0, fulltime: 0, errors: 0 };
    const results: any[] = [];

    for (const post of posts) {
      try {
        const rating = await rateOffer(post.title, post.selftext);
        
        if (rating.isAggregator || rating.isFulltime || rating.stars === 0) {
          if (rating.isAggregator) rated.aggregator++;
          else if (rating.isFulltime) rated.fulltime++;
          else rated.filtered++;
          results.push({ id: post.id, rating, filtered: true });
          continue;
        }

        // Save AI summary
        await updateAiSummary(post.id, rating.explanation, rating.stars * 2);
        rated.good++;
        results.push({ id: post.id, rating, filtered: false });
      } catch {
        rated.errors++;
      }
    }

    return NextResponse.json({ ...rated, total: posts.length, results });
  }

  // Single post analysis
  if (postId) {
    const posts = await getPosts({ limit: 1000 });
    const post = posts.find(p => p.id === postId);
    if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
    
    const result = await analyzePost(post.title, post.selftext);
    await updateAiSummary(post.id, result.summary, result.relevanceScore);
    return NextResponse.json(result);
  }

  // Batch analysis (old behavior)
  if (all) {
    const posts = await getPosts({ unreadOnly: false, limit: 200 });
    let analyzed = 0;
    for (const post of posts) {
      if (post.ai_summary) continue;
      try {
        const result = await analyzePost(post.title, post.selftext);
        await updateAiSummary(post.id, result.summary, result.relevanceScore);
        analyzed++;
      } catch { /* skip */ }
    }
    return NextResponse.json({ analyzed });
  }

  return NextResponse.json({ error: 'need postId, all, or rate' }, { status: 400 });
}
