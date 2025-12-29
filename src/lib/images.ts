// Extract og:image from any URL
export async function extractArticleImage(url: string): Promise<string | null> {
  try {
    console.log('Extracting image from:', url);
    
    // Skip reddit/hn discussion links - they don't have article images
    if (url.includes('reddit.com') || url.includes('redd.it') || url.includes('news.ycombinator.com')) {
      console.log('Skipping aggregator URL:', url);
      return null;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log('Failed to fetch URL:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('Fetched HTML length:', html.length);
    
    // Try all common image meta tags
    const patterns = [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      /<meta[^>]*name=["']twitter:image:src["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image:src["']/i,
      /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i,
      /<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        let imageUrl = match[1];
        
        // Fix relative URLs
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url);
          imageUrl = urlObj.origin + imageUrl;
        }
        
        // Decode HTML entities
        imageUrl = imageUrl
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        console.log('Found image:', imageUrl);
        return imageUrl;
      }
    }
    
    console.log('No og:image found in HTML');
    return null;
  } catch (error) {
    console.error('Image extraction error:', error);
    return null;
  }
}

// Get image for a post - returns URL or null
export async function getPostImage(url: string): Promise<string | null> {
  return extractArticleImage(url);
}
