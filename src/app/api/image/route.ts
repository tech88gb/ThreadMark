import { NextRequest, NextResponse } from 'next/server';
import { getPostImage } from '@/lib/images';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ success: false, error: 'Missing URL' }, { status: 400 });
    }

    console.log('Image API - Received URL:', url);

    // Skip Reddit/HN self-posts - they don't have article images
    if (url.includes('reddit.com') || url.includes('redd.it') || url.includes('news.ycombinator.com')) {
      console.log('Skipping aggregator URL - no image to extract');
      return NextResponse.json({
        success: true,
        data: { imageUrl: null, isAggregator: true },
      });
    }

    const imageUrl = await getPostImage(url);
    console.log('Image API - Extracted image:', imageUrl);

    return NextResponse.json({
      success: true,
      data: { imageUrl },
    });
  } catch (error) {
    console.error('Image error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get image' }, { status: 500 });
  }
}
