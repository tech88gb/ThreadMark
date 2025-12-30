import { PostsStorage, RedditPost } from '@/types/reddit';

const EXPIRY_DAYS = 4;

// In-memory storage for Vercel (since filesystem is read-only)
let memoryStorage: PostsStorage | null = null;

// Remove posts older than EXPIRY_DAYS
function cleanupOldPosts(posts: RedditPost[]): RedditPost[] {
  const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return posts.filter((post) => {
    const postDate = post.posted_at 
      ? new Date(post.posted_at).getTime() 
      : post.created_utc * 1000;
    return postDate > cutoff;
  });
}

// Check if storage itself is expired
function isStorageExpired(generatedAt: string): boolean {
  const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return new Date(generatedAt).getTime() < cutoff;
}

export async function readPosts(): Promise<PostsStorage> {
  // Use in-memory storage for Vercel
  if (!memoryStorage) {
    memoryStorage = { 
      generated_at: new Date().toISOString(), 
      posts: [], 
      posted: [] 
    };
  }
  
  // Auto-cleanup: if storage is older than 4 days, reset everything
  if (isStorageExpired(memoryStorage.generated_at)) {
    memoryStorage = { 
      generated_at: new Date().toISOString(), 
      posts: [], 
      posted: [] 
    };
    return memoryStorage;
  }
  
  // Clean up old posts from both lists
  const originalPostsCount = memoryStorage.posts.length;
  const originalPostedCount = memoryStorage.posted.length;
  
  memoryStorage.posts = cleanupOldPosts(memoryStorage.posts);
  memoryStorage.posted = cleanupOldPosts(memoryStorage.posted);
  
  return memoryStorage;
}

export async function savePosts(posts: RedditPost[]): Promise<PostsStorage> {
  const existing = await readPosts();
  
  // Get IDs of posts already marked as done or deleted
  const postedIds = new Set(existing.posted.map(p => p.id));
  
  // Filter out posts that have already been marked as done
  const filteredPosts = posts.filter(post => !postedIds.has(post.id));
  
  memoryStorage = {
    generated_at: new Date().toISOString(),
    posts: cleanupOldPosts(filteredPosts),
    posted: cleanupOldPosts(existing.posted),
  };
  
  return memoryStorage;
}

export async function deletePost(postId: string): Promise<PostsStorage> {
  const storage = await readPosts();
  storage.posts = storage.posts.filter(post => post.id !== postId);
  memoryStorage = storage;
  return storage;
}

export async function markAsPosted(postId: string): Promise<PostsStorage> {
  const storage = await readPosts();
  const postIndex = storage.posts.findIndex(p => p.id === postId);
  
  if (postIndex !== -1) {
    const post = storage.posts[postIndex];
    post.posted_at = new Date().toISOString();
    storage.posted.unshift(post);
    storage.posts.splice(postIndex, 1);
  }
  
  memoryStorage = storage;
  return storage;
}

export async function clearPostedHistory(): Promise<PostsStorage> {
  const storage = await readPosts();
  storage.posted = [];
  memoryStorage = storage;
  return storage;
}
