import { NextResponse } from 'next/server';
import { markAsPosted } from '@/lib/storage';

// POST /api/posts/:id/posted - Mark a post as posted to X
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Post ID is required' },
        { status: 400 }
      );
    }
    
    const storage = await markAsPosted(id);
    
    return NextResponse.json({
      success: true,
      message: `Post ${id} marked as posted`,
      data: storage,
    });
  } catch (error) {
    console.error('Error marking post as posted:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
