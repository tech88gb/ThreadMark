'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RedditPost, PostsStorage, Stats, TweetTone, GeneratedTweet } from '@/types/reddit';

type Tab = 'pending' | 'history' | 'stats';
type ModalMode = 'tweet' | 'thread';

const CTA_OPTIONS = [
  { id: 'none', label: 'None', text: '' },
  { id: 'thoughts', label: 'thoughts?', text: '\n\nthoughts?' },
  { id: 'agree', label: 'agree/disagree?', text: '\n\nagree or disagree?' },
  { id: 'reply', label: 'your take?', text: '\n\nreply with your take' },
  { id: 'wrong', label: 'am I wrong?', text: '\n\nam I wrong?' },
  { id: 'discuss', label: 'discuss 👇', text: '\n\nlet\'s discuss 👇' },
] as const;

interface TweetModalState {
  isOpen: boolean;
  post: RedditPost | null;
  tweets: GeneratedTweet[];
  selectedTweet: number;
  loading: boolean;
  tone: TweetTone;
  imageUrl: string | null;
  imageLoading: boolean;
  mode: ModalMode;
  thread: string[];
  threadLoading: boolean;
  selectedCTA: string;
}

export default function Dashboard() {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [posted, setPosted] = useState<RedditPost[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [tweetModal, setTweetModal] = useState<TweetModalState>({
    isOpen: false, post: null, tweets: [], selectedTweet: 0,
    loading: false, tone: 'hottake', imageUrl: null, imageLoading: false,
    mode: 'tweet', thread: [], threadLoading: false, selectedCTA: 'none',
  });


  const stats: Stats = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const bySubreddit: Record<string, number> = {};
    const bySource: Record<string, number> = { reddit: 0, hackernews: 0, techcrunch: 0, wired: 0, googlenews: 0 };
    let postedToday = 0;
    let postedThisWeek = 0;

    posted.forEach((post) => {
      const postedTime = post.posted_at ? new Date(post.posted_at).getTime() : 0;
      if (postedTime > oneDayAgo) postedToday++;
      if (postedTime > oneWeekAgo) postedThisWeek++;
      bySubreddit[post.subreddit] = (bySubreddit[post.subreddit] || 0) + 1;
      bySource[post.source] = (bySource[post.source] || 0) + 1;
    });

    return { totalPosted: posted.length, postedToday, postedThisWeek, bySubreddit, bySource };
  }, [posted]);

  const updateFromStorage = (storage: PostsStorage) => {
    setPosts(storage.posts);
    setPosted(storage.posted || []);
    setGeneratedAt(storage.generated_at);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/posts');
      const json = await res.json();
      if (json.success) updateFromStorage(json.data);
      else setError(json.error);
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNewPosts = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch('/api/fetch');
      const json = await res.json();
      if (json.success) {
        updateFromStorage(json.data);
        setActiveTab('pending');
      } else setError(json.error);
    } catch {
      setError('Failed to fetch');
    } finally {
      setFetching(false);
    }
  };


  const deletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) updateFromStorage(json.data);
      else setError(json.error || 'Failed to delete');
    } catch {
      setError('Failed to delete');
    }
  };

  const markAsPosted = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/posted`, { method: 'POST' });
      const json = await res.json();
      if (json.success) updateFromStorage(json.data);
      else setError(json.error || 'Failed to mark');
    } catch {
      setError('Failed to mark');
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all history?')) return;
    try {
      const res = await fetch('/api/posts/history', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) setPosted([]);
    } catch {
      setError('Failed to clear');
    }
  };

  const copy = async (text: string, id: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(`${id}-${type}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  useEffect(() => { loadPosts(); }, [loadPosts]);


  // Tweet generation functions
  const openTweetModal = (post: RedditPost) => {
    setTweetModal({
      isOpen: true, post, tweets: [], selectedTweet: 0,
      loading: true, tone: 'hottake', imageUrl: null, imageLoading: true,
      mode: 'tweet', thread: [], threadLoading: false, selectedCTA: 'none',
    });
    
    // Fetch tweets and image in parallel (don't await, let them update state)
    generateTweetsForPost(post, 'hottake');
    fetchPostImage(post);
  };

  const generateTweetsForPost = async (post: RedditPost, tone: TweetTone) => {
    setTweetModal(prev => ({ ...prev, loading: true, tone, selectedTweet: 0 }));
    try {
      const res = await fetch('/api/tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, url: post.url, tone }),
      });
      const json = await res.json();
      if (json.success && json.data.tweets?.length) {
        setTweetModal(prev => ({ ...prev, tweets: json.data.tweets, loading: false }));
      } else {
        setTweetModal(prev => ({ ...prev, tweets: [], loading: false }));
      }
    } catch {
      setTweetModal(prev => ({ ...prev, tweets: [], loading: false }));
    }
  };

  const generateThreadForPost = async (post: RedditPost) => {
    setTweetModal(prev => ({ ...prev, threadLoading: true, mode: 'thread' }));
    try {
      const res = await fetch('/api/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, url: post.url }),
      });
      const json = await res.json();
      if (json.success && json.data.thread?.tweets?.length) {
        setTweetModal(prev => ({ ...prev, thread: json.data.thread.tweets, threadLoading: false }));
      } else {
        setTweetModal(prev => ({ ...prev, thread: [], threadLoading: false }));
      }
    } catch {
      setTweetModal(prev => ({ ...prev, thread: [], threadLoading: false }));
    }
  };

  const fetchPostImage = async (post: RedditPost) => {
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: post.url }),
      });
      const json = await res.json();
      if (json.success && json.data.imageUrl) {
        setTweetModal(prev => ({ ...prev, imageUrl: json.data.imageUrl, imageLoading: false }));
      } else {
        setTweetModal(prev => ({ ...prev, imageLoading: false }));
      }
    } catch {
      setTweetModal(prev => ({ ...prev, imageLoading: false }));
    }
  };


  const postToX = (tweetText: string) => {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank');
  };

  const closeTweetModal = () => {
    setTweetModal({
      isOpen: false, post: null, tweets: [], selectedTweet: 0,
      loading: false, tone: 'hottake', imageUrl: null, imageLoading: false,
      mode: 'tweet', thread: [], threadLoading: false, selectedCTA: 'none',
    });
  };

  const subredditColors: Record<string, string> = {
    technology: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    programming: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    technews: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    MachineLearning: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    artificial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    netsec: 'bg-red-500/10 text-red-400 border-red-500/20',
    cybersecurity: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    gadgets: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    HackerNews: 'bg-orange-600/10 text-orange-500 border-orange-600/20',
    TechCrunch: 'bg-green-600/10 text-green-500 border-green-600/20',
    Wired: 'bg-purple-600/10 text-purple-500 border-purple-600/20',
    GoogleNews: 'bg-red-600/10 text-red-500 border-red-600/20',
  };

  const getSubredditStyle = (sub: string) => subredditColors[sub] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';

  const getSourceBadge = (source: string) => {
    const badges = {
      reddit: { label: 'Reddit', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      hackernews: { label: 'HN', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      techcrunch: { label: 'TC', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
      wired: { label: 'Wired', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      googlenews: { label: 'GNews', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    return badges[source as keyof typeof badges] || badges.reddit;
  };

  const toneOptions: { value: TweetTone; label: string; emoji: string }[] = [
    { value: 'hottake', label: 'Hot Take', emoji: '🔥' },
    { value: 'analytical', label: 'Analytical', emoji: '🧠' },
    { value: 'sarcastic', label: 'Sarcastic', emoji: '😏' },
    { value: 'unhinged', label: 'Unhinged', emoji: '😈' },
  ];


  const PostCard = ({ post, isHistory = false }: { post: RedditPost; isHistory?: boolean }) => {
    const sourceBadge = getSourceBadge(post.source);
    
    return (
    <article className={`bg-white dark:bg-gray-900 border rounded-lg p-5 hover:shadow-md transition-shadow ${
      post.trending 
        ? 'border-orange-300 dark:border-orange-500/50 ring-1 ring-orange-200 dark:ring-orange-500/20' 
        : 'border-gray-200 dark:border-gray-800'
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {post.trending && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded">
                TRENDING · {post.trendingCount} sources
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${sourceBadge.color}`}>
              {sourceBadge.label}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSubredditStyle(post.subreddit)}`}>
              {post.subreddit}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(post.created_utc)} ago</span>
          </div>
          
          <h3 className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed mb-4">
            {post.title}
          </h3>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openTweetModal(post)}
              className="px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Generate Tweet
            </button>
            <button
              onClick={() => copy(`${post.title}\n\n${post.url}`, post.id, 'all')}
              className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:opacity-90 transition-opacity"
            >
              {copiedId === `${post.id}-all` ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Open ↗
            </a>
            {!isHistory && (
              <>
                <button
                  onClick={() => markAsPosted(post.id)}
                  className="px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => deletePost(post.id)}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};


  // Tweet Modal Component
  const TweetModal = () => {
    if (!tweetModal.isOpen || !tweetModal.post) return null;
    
    const selectedTweet = tweetModal.tweets[tweetModal.selectedTweet];
    const selectedCTA = CTA_OPTIONS.find(c => c.id === tweetModal.selectedCTA);
    const tweetWithCTA = selectedTweet ? selectedTweet.text + (selectedCTA?.text || '') : '';
    const charCount = tweetWithCTA.length;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Content</h2>
              <button onClick={closeTweetModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{tweetModal.post.title}</p>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Mode Toggle: Tweet vs Thread */}
            <div className="flex gap-2">
              <button
                onClick={() => setTweetModal(prev => ({ ...prev, mode: 'tweet' }))}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  tweetModal.mode === 'tweet'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Single Tweet
              </button>
              <button
                onClick={() => {
                  setTweetModal(prev => ({ ...prev, mode: 'thread' }));
                  if (tweetModal.thread.length === 0) {
                    generateThreadForPost(tweetModal.post!);
                  }
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  tweetModal.mode === 'thread'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                🧵 Thread (4 tweets)
              </button>
            </div>

            {/* Single Tweet Mode */}
            {tweetModal.mode === 'tweet' && (
              <>
                {/* Tone Selector */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Tone</label>
                  <div className="flex gap-2 flex-wrap">
                    {toneOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => generateTweetsForPost(tweetModal.post!, option.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          tweetModal.tone === option.value
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        {option.emoji} {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tweet Variations */}
                {tweetModal.loading ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                    <span className="ml-3 text-gray-500">Generating tweets...</span>
                  </div>
                ) : tweetModal.tweets.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose a variation</label>
                    {tweetModal.tweets.map((tweet, index) => (
                      <button
                        key={index}
                        onClick={() => setTweetModal(prev => ({ ...prev, selectedTweet: index }))}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          tweetModal.selectedTweet === index
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <p className="text-gray-900 dark:text-gray-100 text-sm">{tweet.text}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* CTA Selector */}
                {selectedTweet && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Add Call-to-Action</label>
                    <div className="flex gap-2 flex-wrap">
                      {CTA_OPTIONS.map((cta) => (
                        <button
                          key={cta.id}
                          onClick={() => setTweetModal(prev => ({ ...prev, selectedCTA: cta.id }))}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            tweetModal.selectedCTA === cta.id
                              ? 'bg-green-500 text-white border-green-500'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-300'
                          }`}
                        >
                          {cta.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview with CTA */}
                {selectedTweet && tweetModal.selectedCTA !== 'none' && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{tweetWithCTA}</p>
                  </div>
                )}

                {/* Character Counter & Actions */}
                {selectedTweet && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm ${charCount > 280 ? 'text-red-500' : 'text-gray-500'}`}>
                        {charCount}/280 characters
                      </span>
                      <button
                        onClick={() => copy(tweetWithCTA, 'tweet', 'text')}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        {copiedId === 'tweet-text' ? 'Copied!' : 'Copy tweet text'}
                      </button>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          postToX(tweetWithCTA);
                          markAsPosted(tweetModal.post!.id);
                          closeTweetModal();
                        }}
                        disabled={charCount > 280}
                        className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Post to X
                      </button>
                      <button
                        onClick={closeTweetModal}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Thread Mode */}
            {tweetModal.mode === 'thread' && (
              <>
                {tweetModal.threadLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                    <span className="ml-3 text-gray-500">Generating thread...</span>
                  </div>
                ) : tweetModal.thread.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Thread Preview</label>
                      <button
                        onClick={() => generateThreadForPost(tweetModal.post!)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        Regenerate
                      </button>
                    </div>
                    {tweetModal.thread.map((tweet, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-medium text-gray-400 mt-1">{index + 1}</span>
                          <p className="text-gray-900 dark:text-gray-100 text-sm flex-1">{tweet}</p>
                          <button
                            onClick={() => copy(tweet, `thread-${index}`, 'text')}
                            className="text-xs text-blue-500 hover:text-blue-600"
                          >
                            {copiedId === `thread-${index}-text` ? '✓' : 'Copy'}
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-gray-400 ml-6">{tweet.length}/280</div>
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => {
                          // Copy all tweets for easy pasting
                          const fullThread = tweetModal.thread.join('\n\n---\n\n');
                          copy(fullThread, 'full-thread', 'text');
                        }}
                        className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mb-3"
                      >
                        {copiedId === 'full-thread-text' ? '✓ Copied all!' : 'Copy entire thread'}
                      </button>
                      <button
                        onClick={() => {
                          postToX(tweetModal.thread[0]);
                          markAsPosted(tweetModal.post!.id);
                        }}
                        className="w-full px-4 py-2.5 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Start thread on X
                      </button>
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Post the first tweet, then reply to it with each subsequent tweet
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Click to generate a thread
                  </div>
                )}
              </>
            )}

            {/* Image Preview - shown in both modes */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              {tweetModal.imageLoading ? (
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : tweetModal.imageUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Image</label>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(tweetModal.imageUrl!);
                          const blob = await response.blob();
                          const img = new Image();
                          img.crossOrigin = 'anonymous';
                          await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = URL.createObjectURL(blob);
                          });
                          const canvas = document.createElement('canvas');
                          canvas.width = img.width;
                          canvas.height = img.height;
                          const ctx = canvas.getContext('2d')!;
                          ctx.drawImage(img, 0, 0);
                          const pngBlob = await new Promise<Blob>((resolve) => {
                            canvas.toBlob((b) => resolve(b!), 'image/png');
                          });
                          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                          setCopiedId('image-copied');
                          setTimeout(() => setCopiedId(null), 2000);
                          URL.revokeObjectURL(img.src);
                        } catch (err) {
                          console.error('Failed to copy image:', err);
                          window.open(tweetModal.imageUrl!, '_blank');
                        }
                      }}
                      className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                    >
                      {copiedId === 'image-copied' ? '✓ Copied!' : '📋 Copy image'}
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={tweetModal.imageUrl} alt="Preview" className="w-full h-auto max-h-40 object-cover" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-500 truncate flex-1">{tweetModal.post?.url}</span>
                  <button
                    onClick={() => copy(tweetModal.post!.url, 'source', 'link')}
                    className="ml-2 text-sm text-blue-500 hover:text-blue-600"
                  >
                    {copiedId === 'source-link' ? '✓' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TweetModal />
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">ThreadMark</h1>
              <p className="text-sm text-gray-500 mt-0.5">Tech content discovery</p>
            </div>
            <button
              onClick={fetchNewPosts}
              disabled={fetching}
              className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {fetching ? 'Fetching...' : 'Fetch Posts'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Navigation */}
        <nav className="flex items-center gap-6 mb-8 border-b border-gray-200 dark:border-gray-800">
          {[
            { id: 'pending', label: 'Pending', count: posts.length },
            { id: 'history', label: 'History', count: posted.length },
            { id: 'stats', label: 'Stats', count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 text-xs text-gray-400">{tab.count}</span>
              )}
            </button>
          ))}
          
          <div className="ml-auto pb-3">
            <button
              onClick={loadPosts}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </nav>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}


        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : activeTab === 'stats' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total', value: stats.totalPosted },
                { label: 'Today', value: stats.postedToday },
                { label: 'This Week', value: stats.postedThisWeek },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {Object.keys(stats.bySubreddit).length > 0 && (
              <>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">By Source</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.bySource)
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([source, count]) => (
                        <div key={source} className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-28 capitalize">{source}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-gray-900 dark:bg-white h-full rounded-full transition-all"
                              style={{ width: `${(count / stats.totalPosted) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">By Topic</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.bySubreddit)
                      .filter(([topic]) => !['HackerNews', 'TechCrunch'].includes(topic))
                      .sort(([, a], [, b]) => b - a)
                      .map(([sub, count]) => (
                        <div key={sub} className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-28">{sub}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-gray-900 dark:bg-white h-full rounded-full transition-all"
                              style={{ width: `${(count / stats.totalPosted) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {stats.totalPosted === 0 && (
              <div className="text-center py-16 text-gray-500">
                No activity yet
              </div>
            )}
          </div>

        ) : activeTab === 'pending' ? (
          posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">No posts available</p>
              <button
                onClick={fetchNewPosts}
                className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity"
              >
                Fetch Posts
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post, i) => (
                <PostCard key={`${post.id}-${i}`} post={post} />
              ))}
            </div>
          )
        ) : posted.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No history yet
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={clearHistory} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
                Clear history
              </button>
            </div>
            <div className="space-y-3">
              {posted.map((post, i) => (
                <PostCard key={`${post.id}-${i}`} post={post} isHistory />
              ))}
            </div>
          </div>
        )}

        {generatedAt && (
          <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400">
            Last updated {timeAgo(new Date(generatedAt).getTime() / 1000)} ago · Reddit + HackerNews + TechCrunch · Auto-expires in 4 days
          </footer>
        )}
      </main>
    </div>
  );
}
