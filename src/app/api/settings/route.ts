import { getKeywords, addKeyword, deleteKeyword, getSubreddits, initDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await initDb();
  const [keywords, subreddits] = await Promise.all([
    getKeywords(),
    getSubreddits(false),
  ]);
  return NextResponse.json({ keywords, subreddits, settings: {} });
}

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();

  if (body.action === 'add_keyword') {
    await addKeyword(body.word, body.weight || 5, body.category || 'general');
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete_keyword') {
    await deleteKeyword(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
