import { initDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { scrapeAll } from '@/lib/scraper';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  await initDb();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);

  try {
    const result = await scrapeAll(controller.signal);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
