// Fetch article summary (first few paragraphs)
export async function fetchArticleSummary(url: string): Promise<string | null> {
  try {
    // Skip reddit links
    if (url.includes('reddit.com') || url.includes('redd.it')) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const html = await response.text();

    // Try to extract article content
    let content = '';

    // Method 1: Look for article/main content tags
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      // Method 2: Look for common content containers
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                        html.match(/<div[^>]*class="[^"]*(?:article|content|post|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (mainMatch) {
        content = mainMatch[1];
      }
    }

    // Extract paragraphs
    const paragraphs = content.match(/<p[^>]*>([^<]+(?:<[^/p][^>]*>[^<]*<\/[^p][^>]*>)*[^<]*)<\/p>/gi) || [];
    
    // Clean and join first 3 paragraphs
    const cleanParagraphs = paragraphs
      .slice(0, 4)
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 50) // Skip short paragraphs
      .slice(0, 3);

    if (cleanParagraphs.length === 0) {
      // Fallback: try meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) {
        return descMatch[1].substring(0, 500);
      }
      return null;
    }

    return cleanParagraphs.join(' ').substring(0, 800);
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

// Company context database - only for major tech companies
const COMPANY_CONTEXT: Record<string, string> = {
  'meta': "Meta (Facebook) has faced criticism for privacy issues, misinformation spread, and the failed metaverse pivot that cost billions. They've been laying off thousands while pushing AI hard.",
  'facebook': "Facebook/Meta has a history of privacy scandals, from Cambridge Analytica to tracking users across the web. They've pivoted hard to AI after the metaverse flopped.",
  'google': "Google has a reputation for killing products people love (Google Reader, Stadia, etc). They're playing catch-up in AI after being disrupted by ChatGPT despite inventing transformers.",
  'apple': "Apple is known for adding features years after Android, marketing them as innovations. They're facing antitrust pressure and have been slow to AI compared to competitors.",
  'microsoft': "Microsoft has made a massive AI bet with OpenAI investment. They've successfully pivoted from the Ballmer era but face questions about AI integration everywhere.",
  'amazon': "Amazon dominates cloud (AWS) and e-commerce but has faced criticism for worker treatment, union busting, and aggressive tactics against competitors.",
  'openai': "OpenAI went from non-profit to $90B valuation. They've had major drama with Sam Altman's brief firing, safety team departures, and questions about their 'open' name.",
  'twitter': "Twitter/X under Elon Musk has been chaotic - mass layoffs, verification changes, advertiser exodus, and constant feature changes. It's become a case study in how not to run an acquisition.",
  'elon': "Elon Musk is controversial - Tesla/SpaceX success vs Twitter chaos, SEC issues, and increasingly political posting. He's either a genius or chaos agent depending who you ask.",
  'tesla': "Tesla dominates EVs but faces increasing competition from legacy automakers and Chinese companies. Quality issues and Elon's Twitter behavior have hurt the brand.",
  'nvidia': "Nvidia has become the most important AI company due to GPU dominance. Their stock has exploded but there are questions about sustainability of AI chip demand.",
  'tiktok': "TikTok faces potential US ban over China/ByteDance ownership concerns. They've revolutionized short-form video but face constant regulatory pressure.",
  'samsung': "Samsung is the Android leader but often follows Apple's lead. They've had issues with folding phones and compete with Chinese brands on price.",
};

export function getCompanyContext(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  
  for (const [company, context] of Object.entries(COMPANY_CONTEXT)) {
    if (lowerTitle.includes(company)) {
      return context;
    }
  }
  
  return null;
}
