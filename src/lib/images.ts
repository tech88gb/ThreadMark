// Extract og:image from any URL
export async function extractArticleImage(url: string): Promise<string | null> {
  try {
    console.log('Image extraction - URL:', url);
    
    // Skip aggregator URLs - they don't have article images
    if (
      url.includes('reddit.com') || 
      url.includes('redd.it') || 
      url.includes('news.ycombinator.com') ||
      url.includes('github.com') // GitHub repos don't have good og:images usually
    ) {
      console.log('Image extraction - Skipping aggregator/code URL');
      return null;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log('Image extraction - HTTP error:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('Image extraction - HTML length:', html.length);
    
    // More comprehensive patterns for og:image and twitter:image
    // Some sites use single quotes, some double, some have spaces
    const patterns = [
      // og:image variations
      /<meta[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i,
      /<meta[^>]+property\s*=\s*["']og:image:url["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]+property\s*=\s*["']og:image:secure_url["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      
      // twitter:image variations
      /<meta[^>]*name\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']twitter:image["']/i,
      /<meta[^>]*name\s*=\s*["']twitter:image:src["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*property\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      
      // Other image meta tags
      /<link[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*itemprop\s*=\s*["']image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        let imageUrl = match[1].trim();
        
        // Skip placeholder/default images
        if (
          imageUrl.includes('placeholder') ||
          imageUrl.includes('default') ||
          imageUrl.includes('logo') ||
          imageUrl.length < 20
        ) {
          continue;
        }
        
        // Fix relative URLs
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          try {
            const urlObj = new URL(url);
            imageUrl = urlObj.origin + imageUrl;
          } catch {
            continue;
          }
        }
        
        // Decode HTML entities
        imageUrl = imageUrl
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        // Validate it looks like an image URL
        if (imageUrl.startsWith('http')) {
          console.log('Image extraction - Found:', imageUrl.substring(0, 100));
          return imageUrl;
        }
      }
    }
    
    // Last resort: try to find any large image in the HTML
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/i);
    if (imgMatch?.[1]) {
      let imageUrl = imgMatch[1];
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        try {
          const urlObj = new URL(url);
          imageUrl = urlObj.origin + imageUrl;
        } catch {
          // ignore
        }
      }
      if (imageUrl.startsWith('http') && !imageUrl.includes('icon') && !imageUrl.includes('logo')) {
        console.log('Image extraction - Found via img tag:', imageUrl.substring(0, 100));
        return imageUrl;
      }
    }
    
    console.log('Image extraction - No image found');
    return null;
  } catch (error) {
    console.error('Image extraction error:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Get image for a post - returns URL or null
export async function getPostImage(url: string): Promise<string | null> {
  return extractArticleImage(url);
}
