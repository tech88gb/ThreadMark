import { NextRequest, NextResponse } from 'next/server';
import { generateTweet, TweetTone } from '@/lib/gemini';
import { fetchArticleSummary, getCompanyContext } from '@/lib/article';

export async function POST(request: NextRequest) {
  try {
    const { title, url, tone = 'hottake' } = await request.json();

    if (!title) {
      return NextResponse.json({ success: false, error: 'Missing title' }, { status: 400 });
    }

    // Fetch article summary and company context in parallel
    const [articleSummary, companyContext] = await Promise.all([
      url ? fetchArticleSummary(url) : Promise.resolve(null),
      Promise.resolve(getCompanyContext(title)),
    ]);

    console.log('Article summary:', articleSummary?.substring(0, 200));
    console.log('Company context:', companyContext ? 'Found' : 'None');

    const tweets = await generateTweet(title, tone as TweetTone, articleSummary, companyContext);

    return NextResponse.json({ success: true, data: { tweets } });
  } catch (error) {
    console.error('Tweet generation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate' }, { status: 500 });
  }
}
