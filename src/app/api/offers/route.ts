import { getPosts, getPostStats, getScrapeLog, getSubreddits, markAllAsSeen, initDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const subreddit = searchParams.get('subreddit') || undefined;
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const [posts, stats, logs, subreddits] = await Promise.all([
    getPosts({ subreddit, unreadOnly, limit, offset }),
    getPostStats(),
    getScrapeLog(),
    getSubreddits(),
  ]);

  return NextResponse.json({ posts, stats, logs, subreddits });
}

export async function PATCH(req: NextRequest) {
  await initDb();
  const { subreddit } = await req.json();
  await markAllAsSeen(subreddit || undefined);
  return NextResponse.json({ ok: true });
}
