import { NextRequest, NextResponse } from 'next/server';
import { generateThread, TweetTone } from '@/lib/gemini';
import { fetchArticleSummary } from '@/lib/article';

export async function POST(request: NextRequest) {
  try {
    const { title, url, tone = 'analytical' } = await request.json();

    if (!title) {
      return NextResponse.json({ success: false, error: 'Missing title' }, { status: 400 });
    }

    // Fetch article summary for more context
    const articleSummary = url ? await fetchArticleSummary(url) : null;

    console.log('Generating thread for:', title.substring(0, 50));

    const thread = await generateThread(title, tone as TweetTone, articleSummary);

    return NextResponse.json({ success: true, data: { thread } });
  } catch (error) {
    console.error('Thread generation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate thread' }, { status: 500 });
  }
}
