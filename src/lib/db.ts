import { Pool, PoolClient } from 'pg';
import { Subreddit, Keyword, RedditPost, DEFAULT_SUBREDDITS, DEFAULT_KEYWORDS_ES, DEFAULT_KEYWORDS_EN } from './types';

const DATABASE_URL = process.env.DATABASE_URL || '';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return _pool;
}

async function query(text: string, params?: any[]): Promise<any[]> {
  const pool = getPool();
  const res = await pool.query(text, params);
  return res.rows;
}

async function ensureTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS subreddits (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      lang TEXT NOT NULL DEFAULT 'en',
      enabled BOOLEAN NOT NULL DEFAULT true,
      subscribers INTEGER NOT NULL DEFAULT 0,
      last_scraped TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS keywords (
      id BIGSERIAL PRIMARY KEY,
      word TEXT UNIQUE NOT NULL,
      weight INTEGER NOT NULL DEFAULT 5,
      category TEXT NOT NULL DEFAULT 'general'
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      subreddit TEXT NOT NULL,
      title TEXT NOT NULL,
      selftext TEXT DEFAULT '',
      url TEXT NOT NULL,
      author TEXT DEFAULT '',
      score INTEGER DEFAULT 0,
      num_comments INTEGER DEFAULT 0,
      created_utc BIGINT NOT NULL,
      is_self BOOLEAN DEFAULT true,
      scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      keywords_matched TEXT DEFAULT '',
      ai_summary TEXT,
      ai_score REAL,
      relevance INTEGER DEFAULT 0,
      seen BOOLEAN DEFAULT false
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_utc DESC)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_relevance ON posts(relevance DESC)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_seen ON posts(seen)`).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS scrape_log (
      id BIGSERIAL PRIMARY KEY,
      subreddit TEXT NOT NULL,
      posts_found INTEGER DEFAULT 0,
      posts_new INTEGER DEFAULT 0,
      posts_relevant INTEGER DEFAULT 0,
      scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

// ── Subreddits ──────────────────────────────────────────────

export async function getSubreddits(enabledOnly = true): Promise<Subreddit[]> {
  if (enabledOnly) {
    return await query('SELECT * FROM subreddits WHERE enabled = true ORDER BY subscribers DESC');
  }
  return await query('SELECT * FROM subreddits ORDER BY subscribers DESC');
}

export async function ensureSubredditsExist(): Promise<void> {
  for (const s of DEFAULT_SUBREDDITS) {
    await query(
      `INSERT INTO subreddits (name, label, lang, enabled, subscribers)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET subscribers = EXCLUDED.subscribers`,
      [s.name, s.label, s.lang, s.enabled, s.subscribers]
    );
  }
}

// ── Keywords ────────────────────────────────────────────────

export async function getKeywords(): Promise<Keyword[]> {
  return await query('SELECT * FROM keywords ORDER BY weight DESC');
}

export async function addKeyword(word: string, weight: number, category: string): Promise<void> {
  await query(
    `INSERT INTO keywords (word, weight, category) VALUES ($1, $2, $3) ON CONFLICT (word) DO UPDATE SET weight = $2, category = $3`,
    [word, weight, category]
  );
}

export async function deleteKeyword(id: number): Promise<void> {
  await query('DELETE FROM keywords WHERE id = $1', [id]);
}

export async function ensureKeywordsExist(): Promise<void> {
  for (const k of [...DEFAULT_KEYWORDS_ES, ...DEFAULT_KEYWORDS_EN]) {
    await query(
      `INSERT INTO keywords (word, weight, category) VALUES ($1, $2, $3) ON CONFLICT (word) DO UPDATE SET weight = $2, category = $3`,
      [k.word, k.weight, k.category]
    );
  }
}

// ── Posts ───────────────────────────────────────────────────

export async function savePost(post: Omit<RedditPost, 'scraped_at' | 'ai_summary' | 'ai_score'>): Promise<boolean> {
  try {
    await query(
      `INSERT INTO posts (id, subreddit, title, selftext, url, author, score, num_comments, created_utc, is_self, keywords_matched, relevance, seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
       ON CONFLICT (id) DO UPDATE SET
         score = EXCLUDED.score,
         num_comments = EXCLUDED.num_comments,
         relevance = GREATEST(posts.relevance, EXCLUDED.relevance)`,
      [post.id, post.subreddit, post.title, post.selftext, post.url, post.author,
       post.score, post.num_comments, post.created_utc, post.is_self,
       post.keywords_matched, post.relevance]
    );
    return true;
  } catch (e: any) {
    console.warn('savePost error:', e.message?.substring(0, 100));
    return false;
  }
}

export async function getPosts(options: {
  subreddit?: string;
  minRelevance?: number;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<RedditPost[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (options.subreddit) { conditions.push(`subreddit = $${idx++}`); params.push(options.subreddit); }
  if (options.minRelevance !== undefined) { conditions.push(`relevance >= $${idx++}`); params.push(options.minRelevance); }
  if (options.unreadOnly) { conditions.push('seen = false'); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return await query(
    `SELECT * FROM posts ${where} ORDER BY relevance DESC, created_utc DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
}

export async function getPostStats(): Promise<{ total: number; unread: number; withAi: number }> {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE seen = false) AS unread,
      COUNT(*) FILTER (WHERE ai_summary IS NOT NULL) AS "withAi"
    FROM posts
  `);
  return rows[0] || { total: 0, unread: 0, withAi: 0 };
}

export async function getUnreadCount(): Promise<number> {
  const rows = await query('SELECT COUNT(*) AS c FROM posts WHERE seen = false');
  return parseInt(rows[0]?.c) || 0;
}

export async function markAllAsSeen(subreddit?: string): Promise<void> {
  if (subreddit) {
    await query('UPDATE posts SET seen = true WHERE subreddit = $1', [subreddit]);
  } else {
    await query('UPDATE posts SET seen = true');
  }
}

export async function updateAiSummary(id: string, summary: string, score: number): Promise<void> {
  await query('UPDATE posts SET ai_summary = $1, ai_score = $2 WHERE id = $3', [summary, score, id]);
}

export async function getScrapeLog(limit = 20): Promise<any[]> {
  return await query('SELECT * FROM scrape_log ORDER BY scraped_at DESC LIMIT $1', [limit]);
}

export async function logScrape(subreddit: string, found: number, newPosts: number, relevant: number): Promise<void> {
  await query(
    'INSERT INTO scrape_log (subreddit, posts_found, posts_new, posts_relevant) VALUES ($1, $2, $3, $4)',
    [subreddit, found, newPosts, relevant]
  );
  await query("UPDATE subreddits SET last_scraped = NOW() WHERE name = $1", [subreddit]);
}

// ── Init ────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  await ensureTables();
  await ensureSubredditsExist();
  await ensureKeywordsExist();
}
