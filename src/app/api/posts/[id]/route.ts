import { NextResponse } from 'next/server';
import { deletePost } from '@/lib/storage';

// DELETE /api/posts/:id - Remove a post from storage
export async function DELETE(
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
    
    const storage = await deletePost(id);
    
    return NextResponse.json({
      success: true,
      message: `Post ${id} deleted`,
      data: storage,
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
