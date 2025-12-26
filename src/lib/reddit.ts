import Parser from 'rss-parser';
import { RedditPost } from '@/types/reddit';

// 8 tech subreddits (removed futurology - lower quality)
const SUBREDDITS = [
  'technology',
  'programming',
  'technews',
  'MachineLearning',
  'artificial',
  'netsec',
  'cybersecurity',
  'gadgets',
];

// HN - stories with 150+ points (guaranteed popular)
const HACKERNEWS_FEED = 'https://hnrss.org/newest?points=150&count=25';
// TechCrunch - major tech news and startup coverage
const TECHCRUNCH_FEED = 'https://techcrunch.com/feed/';

const POSTS_PER_SUBREDDIT = 10; // Fetch more to ensure 25 after dedup
const TOTAL_TARGET = 25;

async function fetchWithHeaders(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
  });
  if (!response.ok) throw new Error(`Status code ${response.status}`);
  return response.text();
}

const parser = new Parser();

function normalizeForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 8)
    .sort()
    .join(' ');
}

function areSameTopic(title1: string, title2: string): boolean {
  const norm1 = normalizeForComparison(title1);
  const norm2 = normalizeForComparison(title2);
  
  if (norm1 === norm2) return true;
  
  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));
  
  let matches = 0;
  words1.forEach(word => { if (words2.has(word)) matches++; });
  
  const minSize = Math.min(words1.size, words2.size);
  return minSize > 0 && matches / minSize >= 0.6;
}

function extractPostId(link: string): string {
  const match = link.match(/comments\/([a-z0-9]+)/i);
  return match ? match[1] : link;
}


// Fetch Reddit top posts from a specific time window
async function fetchRedditSubreddit(subreddit: string, timeWindow: 'day' | 'week'): Promise<RedditPost[]> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/top/.rss?t=${timeWindow}`;
    const xml = await fetchWithHeaders(url);
    const feed = await parser.parseString(xml);

    return feed.items.slice(0, POSTS_PER_SUBREDDIT).map((item, index) => ({
      id: extractPostId(item.link || ''),
      title: item.title || 'Untitled',
      subreddit,
      score: 0,
      num_comments: 0,
      url: item.link || '',
      created_utc: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0,
      permalink: item.link || '',
      subredditRank: index + 1,
      source: 'reddit' as const,
    }));
  } catch (error) {
    console.error(`Error fetching r/${subreddit} (${timeWindow}):`, error);
    return [];
  }
}

// Fetch from all Reddit subreddits - only use WEEK for truly popular posts
async function fetchAllReddit(): Promise<RedditPost[]> {
  // Only fetch top from week - these are the truly popular posts
  const weekPosts = await Promise.all(
    SUBREDDITS.map(sub => fetchRedditSubreddit(sub, 'week'))
  );
  
  return weekPosts.flat();
}

// Fetch from HackerNews - only high-point stories (150+)
async function fetchHackerNews(): Promise<RedditPost[]> {
  try {
    const xml = await fetchWithHeaders(HACKERNEWS_FEED);
    const feed = await parser.parseString(xml);

    return feed.items.slice(0, 20).map((item, index) => {
      const link = item.link || '';
      const commentsMatch = item.comments?.match(/item\?id=(\d+)/);
      const hnId = commentsMatch ? commentsMatch[1] : `hn-${Date.now()}-${index}`;

      return {
        id: `hn-${hnId}`,
        title: item.title || 'Untitled',
        subreddit: 'HackerNews',
        score: 0,
        num_comments: 0,
        url: link,
        created_utc: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0,
        permalink: item.comments || link,
        subredditRank: index + 1,
        source: 'hackernews' as const,
      };
    });
  } catch (error) {
    console.error('Error fetching HackerNews:', error);
    return [];
  }
}

// Fetch from TechCrunch - major tech news
async function fetchTechCrunch(): Promise<RedditPost[]> {
  try {
    const xml = await fetchWithHeaders(TECHCRUNCH_FEED);
    const feed = await parser.parseString(xml);
    
    // Get recent articles (last 3 days for freshness)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    
    const recentPosts = feed.items
      .filter(item => {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        return pubDate > threeDaysAgo;
      })
      .slice(0, 20);

    return recentPosts.map((item, index) => {
      const link = item.link || '';
      // Create a safe ID by extracting slug and removing slashes
      const slug = link.split('/').pop() || `tc-${Date.now()}-${index}`;
      const tcId = `tc-${slug}`;

      return {
        id: tcId,
        title: item.title || 'Untitled',
        subreddit: 'TechCrunch',
        score: 0,
        num_comments: 0,
        url: link,
        created_utc: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0,
        permalink: link,
        subredditRank: index + 1,
        source: 'techcrunch' as const,
      };
    });
  } catch (error) {
    console.error('Error fetching TechCrunch:', error);
    return [];
  }
}


// Detect trending across ALL sources
function detectTrending(posts: RedditPost[]): RedditPost[] {
  const topicGroups: Map<string, RedditPost[]> = new Map();
  
  for (const post of posts) {
    let foundGroup = false;
    
    for (const [, group] of topicGroups) {
      if (areSameTopic(post.title, group[0].title)) {
        if (!group.some(p => p.source === post.source && p.subreddit === post.subreddit)) {
          group.push(post);
        }
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      topicGroups.set(normalizeForComparison(post.title), [post]);
    }
  }
  
  const trendingTopics = new Map<string, number>();
  
  for (const [key, group] of topicGroups) {
    if (group.length >= 2) {
      trendingTopics.set(key, group.length);
    }
  }
  
  return posts.map(post => {
    for (const [key, count] of trendingTopics) {
      if (areSameTopic(post.title, key)) {
        return { ...post, trending: true, trendingCount: count };
      }
    }
    return post;
  });
}

// Deduplicate - remove similar posts, keep best version
function deduplicatePosts(posts: RedditPost[]): RedditPost[] {
  const seen = new Map<string, RedditPost>();
  const seenUrls = new Set<string>();
  
  for (const post of posts) {
    if (seenUrls.has(post.url)) continue;
    
    let isDuplicate = false;
    for (const [existingNorm] of seen) {
      if (areSameTopic(post.title, existingNorm)) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      seen.set(normalizeForComparison(post.title), post);
      seenUrls.add(post.url);
    }
  }
  
  return Array.from(seen.values());
}

// Main fetch function - ALWAYS returns exactly 25 posts
export async function fetchRedditPosts(): Promise<RedditPost[]> {
  console.log('Fetching from Reddit (top/week), HackerNews, and TechCrunch...');
  
  // Fetch from all sources in parallel
  const [redditPosts, hnPosts, tcPosts] = await Promise.all([
    fetchAllReddit(),
    fetchHackerNews(),
    fetchTechCrunch(),
  ]);
  
  console.log(`Fetched - Reddit: ${redditPosts.length}, HN: ${hnPosts.length}, TC: ${tcPosts.length}`);
  
  // Combine all posts
  const allPosts = [...redditPosts, ...hnPosts, ...tcPosts];
  
  // Detect trending across all sources
  const withTrending = detectTrending(allPosts);
  
  // Sort by: trending first, then by rank within source, then by recency
  withTrending.sort((a, b) => {
    if (a.trending && !b.trending) return -1;
    if (!a.trending && b.trending) return 1;
    const rankDiff = (a.subredditRank || 99) - (b.subredditRank || 99);
    if (rankDiff !== 0) return rankDiff;
    return b.created_utc - a.created_utc;
  });
  
  // Deduplicate
  const uniquePosts = deduplicatePosts(withTrending);
  
  console.log(`After dedup: ${uniquePosts.length} unique posts`);
  
  // Final sort: trending first, then by recency
  uniquePosts.sort((a, b) => {
    if (a.trending && !b.trending) return -1;
    if (!a.trending && b.trending) return 1;
    return b.created_utc - a.created_utc;
  });
  
  // ALWAYS return exactly 25 posts
  // If we have more than 25, take top 25
  // If we have less than 25, we still return what we have (edge case)
  const result = uniquePosts.slice(0, TOTAL_TARGET);
  
  console.log(`Returning ${result.length} posts (target: ${TOTAL_TARGET})`);
  
  // If we don't have enough, log a warning
  if (result.length < TOTAL_TARGET) {
    console.warn(`Warning: Only ${result.length} posts available, target was ${TOTAL_TARGET}`);
  }
  
  return result;
}
