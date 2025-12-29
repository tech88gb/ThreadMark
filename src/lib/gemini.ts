import { GoogleGenerativeAI } from '@google/generative-ai';

export type TweetTone = 'hottake' | 'analytical' | 'sarcastic' | 'unhinged';

export interface GeneratedTweet {
  text: string;
  tone: TweetTone;
  characterCount: number;
}

export async function generateTweet(
  title: string,
  tone: TweetTone = 'hottake',
  articleSummary: string | null = null,
  companyContext: string | null = null
): Promise<GeneratedTweet[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: tone === 'unhinged' ? 1.1 : tone === 'sarcastic' ? 0.95 : tone === 'analytical' ? 0.7 : 0.9,
    }
  });

  let context = `NEWS: "${title}"`;
  if (articleSummary) {
    context += `\n\nARTICLE: ${articleSummary.substring(0, 400)}`;
  }
  if (companyContext) {
    context += `\n\nBACKGROUND: ${companyContext}`;
  }

  const tonePrompts: Record<TweetTone, string> = {
    hottake: `Write like someone who's been in tech for years and is tired of the BS. Not trying to be funny, just stating facts that happen to be brutal.

VOICE: Confident, direct, slightly jaded. Like texting a friend about industry news.

GOOD TWEETS (this energy):
- "they've been doing the opposite of this for 5 years but sure"
- "funny how this drops right after the earnings call"  
- "remember when they said they'd never do this? I remember"
- "this is literally just [thing] with extra steps"
- "the bar was on the floor and they brought a shovel"

AVOID these AI patterns:
- Starting with "So" or "Well"
- Using "wild" "insane" "crazy" "incredible"
- Rhetorical questions
- Explaining the joke
- Sounding impressed or excited`,

    analytical: `Write like a tech insider sharing genuine insight. You understand the business side, not just the product. Keep it to 2 sentences max.

VOICE: Informed, connecting dots. Like a senior engineer explaining context in slack.

GOOD TWEETS (this energy):
- "this is really about their Q2 numbers, the feature is just the excuse"
- "makes more sense when you know their enterprise contracts are up"
- "third time they've tried this. different market now"
- "the timing here isn't random"

AVOID these AI patterns:
- Starting with "The real story is..." or "Here's the thing"
- Numbered lists or bullet points
- Sounding like a LinkedIn post
- Using "landscape" "ecosystem" "leverage"`,

    sarcastic: `Write like someone who's seen this exact thing happen 10 times before. Dry, understated, not trying hard.

VOICE: Deadpan, ironic, tired. The humor comes from understatement, not exaggeration.

GOOD TWEETS (this energy):
- "ah yes, the classic 'we care about users now' pivot"
- "can't wait to see how this gets walked back in 6 months"
- "incredible how they managed to make [thing] worse"
- "they really said 'what if we did [bad thing] but called it [good thing]'"

AVOID these AI patterns:
- "Revolutionary. Groundbreaking." (overused)
- Obvious sarcasm markers like /s
- Being actually mean or cruel
- Explaining why it's ironic`,

    unhinged: `Write like someone who spends too much time online but is actually making a point. Lowercase, casual, meme-adjacent.

VOICE: Chaotic but relatable. The joke is in the delivery, not the content.

GOOD TWEETS (this energy):
- "me watching this unfold knowing exactly how it ends"
- "we're really just doing this now huh"
- "the way they announced this like we wouldn't notice"
- "not them acting like this is new"

AVOID these AI patterns:
- Forced meme references
- "the simulation" jokes
- Random emojis everywhere
- ALL CAPS for emphasis`,
  };

  const prompt = `${context}

${tonePrompts[tone]}

Write 3 tweets about this news. Each tweet should:
- Be 1-2 sentences max
- Take a different angle on the story
- Sound like an actual person typed it, NOT like AI or a brand
- Reference something specific from the news

CRITICAL: Do NOT use these AI giveaway phrases: "Let's talk about", "Here's the thing", "I mean", "Look,", "Honestly,", "It's giving", "The fact that", "Imagine", "Picture this"

Return only JSON:
{"tweets":[{"text":"..."},{"text":"..."},{"text":"..."}]}`;

  try {
    console.log('Gemini - Calling with tone:', tone);
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log('Gemini response:', response.substring(0, 300));
    
    let clean = response.trim();
    if (clean.includes('```')) {
      clean = clean.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    }
    
    const parsed = JSON.parse(clean);
    
    if (!parsed.tweets?.length) {
      throw new Error('No tweets in response');
    }
    
    return parsed.tweets.slice(0, 3).map((t: { text: string }) => ({
      text: t.text || '',
      tone,
      characterCount: (t.text || '').length,
    })).filter((t: GeneratedTweet) => t.text.length > 0);
  } catch (error) {
    console.error('Gemini error:', error instanceof Error ? error.message : error);
    return generateFallbackTweets(title, tone);
  }
}

function generateFallbackTweets(title: string, tone: TweetTone): GeneratedTweet[] {
  const short = title.length > 40 ? title.substring(0, 40) + '...' : title;
  
  const fallbacks: Record<TweetTone, string[]> = {
    hottake: [
      `they've been saying the opposite for years but sure`,
      `funny timing on this one`,
      `we're really doing this again huh`,
    ],
    analytical: [
      `this is really about their upcoming earnings, the rest is just positioning`,
      `makes more sense when you look at what their competitors announced last week`,
      `third time they've tried this approach. curious if anything's different now`,
    ],
    sarcastic: [
      `ah yes, because that worked so well last time`,
      `can't wait to see how this gets quietly reversed`,
      `the audacity is almost impressive`,
    ],
    unhinged: [
      `me watching this knowing exactly how it ends`,
      `we're really just doing this now`,
      `not them acting like we wouldn't notice`,
    ],
  };

  return fallbacks[tone].map((text) => ({
    text,
    tone,
    characterCount: text.length,
  }));
}
