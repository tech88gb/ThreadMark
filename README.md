# ThreadMark

A content discovery dashboard that aggregates the best tech posts from Reddit, HackerNews, and TechCrunch with AI-powered tweet generation.

## Features

- **Multi-source aggregation**: Reddit + HackerNews + TechCrunch = 25 top posts
- **Trending detection**: Highlights stories appearing across multiple sources
- **AI Tweet Generation**: Gemini-powered human-like tweets with tone selection
- **One-click X posting**: Opens X/Twitter with pre-filled tweet via Intent URL
- **Article images**: Extracts og:image or generates custom cards
- **Track what you've shared**: Mark posts as done and view history
- **Auto-cleanup**: Posts expire after 4 days
- **Stats dashboard**: See your activity by source and topic

## Tweet Generation

Click "Generate Tweet" on any post to:
1. Choose a tone (Casual, Professional, Witty, Bold)
2. Get 3 AI-generated tweet variations
3. See article preview image
4. One-click post to X with pre-filled text

No X API needed - uses free Intent URLs.

## Sources

**Reddit (8 subreddits, top/week for quality):**
- r/technology, r/programming, r/technews
- r/MachineLearning, r/artificial
- r/netsec, r/cybersecurity
- r/gadgets

**HackerNews:**
- Stories with 150+ points

**TechCrunch:**
- Latest tech news and startup coverage (last 3 days)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

Create a `.env` file:

```env
# Required for tweet generation (get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here
```

Tweet generation works with Gemini's free tier (60 requests/minute).

## Deploy

```bash
vercel
```

Add `GEMINI_API_KEY` to your Vercel environment variables.
