import { getPosts, updateAiSummary, initDb } from '@/lib/db';
import { analyzePost } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await initDb();
  const { postId, all } = await req.json();

  if (all) {
    const posts = await getPosts({ unreadOnly: false, limit: 200 });
    let analyzed = 0;
    for (const post of posts) {
      if (post.ai_summary) continue;
      try {
        const result = await analyzePost(post.title, post.selftext);
        await updateAiSummary(post.id, result.summary, result.relevanceScore);
        analyzed++;
      } catch (e) {
        console.warn(`AI error on ${post.id}:`, e);
      }
    }
    return NextResponse.json({ analyzed });
  }

  if (postId) {
    const posts = await getPosts({ limit: 1000 });
    const post = posts.find(p => p.id === postId);
    if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const result = await analyzePost(post.title, post.selftext);
    await updateAiSummary(post.id, result.summary, result.relevanceScore);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'need postId or all' }, { status: 400 });
}
