import { RedditPost, Keyword } from './types';

function matchKeywords(text: string, keywords: Keyword[]): { matched: string[]; score: number } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.word.toLowerCase())) {
      matched.push(kw.word);
      score += kw.weight;
    }
  }
  return { matched: [...new Set(matched)], score };
}

const RELEVANCE_THRESHOLD = 5;

function extractBetween(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  if (s === -1) return '';
  const from = s + start.length;
  const e = text.indexOf(end, from);
  if (e === -1) return text.substring(from);
  return text.substring(from, e);
}

const FORTY_EIGHT_HOURS = 48 * 60 * 60;

function extractPostsFromRSS(xml: string, subreddit: string, keywords: Keyword[]): Array<{ post: Omit<RedditPost, 'scraped_at' | 'ai_summary' | 'ai_score'>; matched: string[] }> {
  const results: Array<{ post: Omit<RedditPost, 'scraped_at' | 'ai_summary' | 'ai_score'>; matched: string[] }> = [];
  
  // Parse entries from RSS XML
  const entries = xml.split('<entry>').slice(1); // Skip first split part
  
  for (const entryXml of entries) {
    // Extract fields using simple string matching (avoid heavy XML parser)
    const getId = (tag: string) => {
      const m = entryXml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : '';
    };
    
    const rawId = getId('id');
    if (!rawId) continue;
    
    const id = rawId.startsWith('t3_') ? rawId : `t3_${rawId}`;
    const title = getId('title');
    const contentHtml = entryXml.includes('<content type="html">') 
      ? extractBetween(entryXml, '<content type="html">', '</content>')
      : extractBetween(entryXml, '<content>', '</content>');
    
    // Clean HTML from content
    const cleanContent = contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    const linkMatch = entryXml.match(/<link href="(.*?)"/);
    const url = linkMatch ? linkMatch[1] : `https://reddit.com/r/${subreddit}/comments/${rawId}`;
    
    const authorMatch = entryXml.match(/<name>(.*?)<\/name>/);
    const author = authorMatch ? authorMatch[1].replace('/u/', '') : '[deleted]';
    
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    let createdUtc = Math.floor(Date.now() / 1000);
    if (updatedMatch) {
      createdUtc = Math.floor(new Date(updatedMatch[1]).getTime() / 1000);
    }
    
    // Skip posts older than 48 hours
    const now = Math.floor(Date.now() / 1000);
    if (now - createdUtc > FORTY_EIGHT_HOURS) continue;

    const categoryMatch = entryXml.match(/<category term="([^"]*)"/);
    const flair = categoryMatch ? categoryMatch[1] : '';
    
    const combined = `${title} ${cleanContent} ${flair}`;
    const { matched, score } = matchKeywords(combined, keywords);
    
    if (score < RELEVANCE_THRESHOLD) continue;
    
    results.push({
      post: {
        id,
        subreddit,
        title: title || '(no title)',
        selftext: cleanContent.substring(0, 2000),
        url,
        author,
        score: 0, // RSS doesn't provide score
        num_comments: 0,
        created_utc: createdUtc,
        is_self: true,
        keywords_matched: matched.join(', '),
        relevance: score,
      },
      matched,
    });
  }
  
  return results;
}

export async function scrapeSubreddit(
  subreddit: string,
  keywords: Keyword[],
  _limit = 50,
  _abortSignal?: AbortSignal
): Promise<{ found: number; saved: number; relevant: number }> {
  const { savePost, logScrape } = await import('./db');
  const urls = [
    `https://www.reddit.com/r/${subreddit}/.rss`,
    `https://www.reddit.com/r/${subreddit}/search.rss?q=freelance+OR+hiring+OR+contract+OR+developer+OR+programmer&sort=new&restrict_sr=on`,
  ];

  const seen = new Set<string>();
  let found = 0, saved = 0, relevant = 0;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/atom+xml, application/xml, text/xml, */*'
        },
      });
      
      if (!res.ok) {
        console.warn(`  ⚠️ ${subreddit} RSS: HTTP ${res.status}`);
        continue;
      }
      
      const xml = await res.text();
      const entries = extractPostsFromRSS(xml, subreddit, keywords);
      
      for (const { post, matched } of entries) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        found++;
        
        await savePost(post);
        saved++;
        relevant++;
      }
    } catch (err: any) {
      console.warn(`  ⚠️ ${subreddit}: ${err.message?.substring(0, 100)}`);
    }
  }

  await logScrape(subreddit, found, saved, relevant);
  return { found, saved, relevant };
}

export async function scrapeAll(abortSignal?: AbortSignal): Promise<{
  totalFound: number; totalSaved: number; totalRelevant: number; errors: string[]
}> {
  const db = await import('./db');
  const subreddits = await db.getSubreddits(true);
  const keywords = await db.getKeywords();

  console.log(`🚀 Scraping ${subreddits.length} subreddits via RSS (${keywords.length} keywords)...\n`);

  let totalFound = 0, totalSaved = 0, totalRelevant = 0;
  const errors: string[] = [];

  for (const sub of subreddits) {
    if (abortSignal?.aborted) break;
    process.stdout.write(`📡 r/${sub.name}... `);
    try {
      const result = await scrapeSubreddit(sub.name, keywords);
      totalFound += result.found;
      totalSaved += result.saved;
      totalRelevant += result.relevant;
      process.stdout.write(`${result.found} found, ${result.saved} saved, ${result.relevant} relevant ✅\n`);
    } catch (e: any) {
      process.stdout.write(`❌ ${e.message?.substring(0, 80)}\n`);
      errors.push(`${sub.name}: ${e.message}`);
    }
  }

  return { totalFound, totalSaved, totalRelevant, errors };
}
