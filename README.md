# ThreadMark

A content discovery dashboard that aggregates trending tech posts from 5 sources with AI-powered tweet generation. Always returns exactly 25 of the best posts.

## Features

- **Multi-source aggregation**: Reddit + HackerNews + TechCrunch + Wired + Google News = 25 top posts
- **Trending detection**: Highlights stories appearing across multiple sources (the viral ones)
- **Self-post filtering**: Only shows link posts with actual articles, skips Reddit discussions
- **AI Tweet Generation**: Gemini-powered human-like tweets with 4 tone options
- **One-click X posting**: Opens X/Twitter with pre-filled tweet via Intent URL
- **Article images**: Extracts og:image from source websites
- **Track what you've shared**: Mark posts as done and view history
- **Auto-cleanup**: Posts expire after 4 days
- **Stats dashboard**: See your activity by source and topic

## Tweet Generation

Click "Generate Tweet" on any post to:
1. Choose a tone: **Hot Take** (opinionated), **Analytical** (insightful), **Sarcastic** (witty), **Unhinged** (chaotic)
2. Get 3 AI-generated tweet variations
3. See article preview image
4. Copy image to clipboard
5. One-click post to X with pre-filled text

No X API needed - uses free Intent URLs.

## Content Sources

**Reddit (8 subreddits, top/week):**
- r/technology, r/programming, r/technews
- r/MachineLearning, r/artificial
- r/netsec, r/cybersecurity, r/gadgets
- Only link posts (filters out discussions)

**HackerNews:**
- Stories with 150+ points (guaranteed popular)

**TechCrunch:**
- Latest tech news and startup coverage (last 3 days)

**Wired:**
- Tech, science, and culture stories (last 5 days)

**Google News Tech:**
- Trending tech stories aggregated from major outlets

## How It Works

1. **Fetch Posts** - Pulls from all 5 sources in parallel
2. **Detect Trending** - Identifies stories appearing on multiple sources
3. **Deduplicate** - Removes similar posts, keeps the best version
4. **Sort** - Trending posts first, then by recency
5. **Return 25** - Always returns exactly 25 posts

Posts appearing on 2+ sources get a "TRENDING" badge and are prioritized.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

Create a `.env` file in the `ThreadMark` directory:

```env
# Required for tweet generation
# Get from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here
```

Tweet generation works with Gemini's free tier (60 requests/minute).

## Deploy

```bash
vercel
```

Add `GEMINI_API_KEY` to your Vercel environment variables.

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Gemini API** - AI tweet generation
- **RSS Parser** - Feed aggregation
- **Vercel** - Hosting

## How to Use

1. Click **Fetch Posts** to get the latest 25 trending tech posts
2. Browse posts by source (Reddit, HN, TechCrunch, Wired, Google News)
3. Click **Generate Tweet** to create AI tweets in different tones
4. Copy the image to clipboard
5. Click **Post to X** to open Twitter with your tweet pre-filled
6. Paste the image and post
7. Click **Done** to move to history

## Tips

- **Trending posts** (appearing on 2+ sources) get the most engagement
- **Hot Take** tone is best for controversial/opinionated content
- **Analytical** tone works for technical/business news
- **Sarcastic** tone for obvious corporate BS
- **Unhinged** tone for chaotic/absurdist humor
- Always copy the image before posting to X
- Posts auto-expire after 4 days

