import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Helper function to generate random integer between min and max (inclusive)
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Initialize the Gemini API with better error handling
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured. Please add your API key to .env.local file. Get your API key from: https://makersuite.google.com/app/apikey');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Types for AI state management
interface AIState {
  currentMood: string;
  moodIntensity: number; // 1-10 scale
  lastMoodChange: string;
  recentMessages: Array<{
    text: string;
    timestamp: string;
    sender: string;
  }>;
  conversationContext: {
    userApologized: boolean;
    aiApologized: boolean;
    lastUserMessageTime: string;
  };
}

interface ConversationMessage {
  text: string;
  sender: 'user' | 'ai';
  timestamp?: string;
}

// Default AI state
const getDefaultAIState = (): AIState => ({
  currentMood: 'friendly',
  moodIntensity: 5,
  lastMoodChange: new Date().toISOString(),
  recentMessages: [],
  conversationContext: {
    userApologized: false,
    aiApologized: false,
    lastUserMessageTime: new Date().toISOString()
  }
});

// Mood definitions with their characteristics
const MOODS = {
  happy: { intensity: 8, traits: ['enthusiastic', 'positive', 'energetic'] },
  friendly: { intensity: 5, traits: ['warm', 'helpful', 'casual'] },
  neutral: { intensity: 5, traits: ['balanced', 'calm', 'straightforward'] },
  slightly_annoyed: { intensity: 3, traits: ['short responses', 'less enthusiastic'] },
  annoyed: { intensity: 2, traits: ['curt', 'impatient', 'direct'] },
  angry: { intensity: 1, traits: ['frustrated', 'sharp', 'defensive'] },
  apologetic: { intensity: 4, traits: ['sorry', 'understanding', 'gentle'] },
  excited: { intensity: 9, traits: ['very enthusiastic', 'lots of emojis', 'exclamations'] },
  sad: { intensity: 3, traits: ['melancholy', 'quiet', 'thoughtful'] },
  busy: { intensity: 4, traits: ['brief', 'distracted', 'hurried'] }
};

// Message filtering logic
function shouldFilterMessage(message: string, aiState: AIState): { shouldFilter: boolean; reason?: string; response?: string } {
  const recentUserMessages = aiState.recentMessages
    .filter(msg => msg.sender === 'user')
    .slice(-5); // Last 5 user messages

  // Check for repetitive messages
  const identicalCount = recentUserMessages.filter(msg => 
    msg.text.toLowerCase().trim() === message.toLowerCase().trim()
  ).length;

  if (identicalCount >= 2) {
    const responses = [
      "I think you already said that! 😅",
      "You're repeating yourself there!",
      "I heard you the first time! 😊",
      "Same message again? Everything okay?",
      "I got it already! Let's talk about something else?"
    ];
    return {
      shouldFilter: true,
      reason: 'repetitive',
      response: responses[Math.floor(Math.random() * responses.length)]
    };
  }

  // Check for very short/meaningless messages sent repeatedly
  const shortMessages = recentUserMessages.filter(msg => 
    msg.text.length <= 3 && Date.now() - new Date(msg.timestamp).getTime() < 30000
  );

  if (shortMessages.length >= 3 && message.length <= 3) {
    return {
      shouldFilter: true,
      reason: 'spam',
      response: "Slow down there! What's really on your mind? 🤔"
    };
  }

  // Simulate being "busy" occasionally (5% chance)
  if (Math.random() < 0.05 && aiState.currentMood !== 'busy') {
    return {
      shouldFilter: true,
      reason: 'busy',
      response: "Give me a sec, I'm thinking about something else right now..."
    };
  }

  return { shouldFilter: false };
}

// Analyze user tone and determine desired AI mood
function analyzeUserTone(message: string, conversationHistory: ConversationMessage[]): string {
  const lowerMessage = message.toLowerCase();
  
  // Check for apologies
  if (lowerMessage.includes('sorry') || lowerMessage.includes('apologize') || lowerMessage.includes('my bad')) {
    return 'apologetic';
  }

  // Check for excitement/happiness
  if (lowerMessage.includes('!') || lowerMessage.includes('awesome') || lowerMessage.includes('great') || 
      lowerMessage.includes('amazing') || lowerMessage.includes('love') || lowerMessage.includes('excited')) {
    return 'happy';
  }

  // Check for frustration/anger
  if (lowerMessage.includes('stupid') || lowerMessage.includes('annoying') || lowerMessage.includes('hate') ||
      lowerMessage.includes('angry') || lowerMessage.includes('frustrated') || lowerMessage.includes('wtf')) {
    return 'annoyed';
  }

  // Check for sadness
  if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('down') ||
      lowerMessage.includes('upset') || lowerMessage.includes('crying')) {
    return 'sad';
  }

  // Check for questions or help-seeking (friendly response)
  if (lowerMessage.includes('?') || lowerMessage.includes('help') || lowerMessage.includes('how')) {
    return 'friendly';
  }

  // Default to current mood if no strong indicators
  return 'neutral';
}

// Determine next AI mood with gradual transitions
function determineAiMood(currentMood: string, desiredMood: string, aiState: AIState): { mood: string; intensity: number } {
  const currentIntensity = MOODS[currentMood as keyof typeof MOODS]?.intensity || 5;
  const desiredIntensity = MOODS[desiredMood as keyof typeof MOODS]?.intensity || 5;

  // Handle apologies - quick mood improvement
  if (desiredMood === 'apologetic' && ['annoyed', 'angry'].includes(currentMood)) {
    return { mood: 'friendly', intensity: 6 };
  }

  // If moods are the same or similar, maintain current
  if (currentMood === desiredMood || Math.abs(currentIntensity - desiredIntensity) <= 1) {
    return { mood: currentMood, intensity: currentIntensity };
  }

  // Gradual mood transitions
  const moodTransitions: { [key: string]: string[] } = {
    happy: ['excited', 'friendly', 'neutral'],
    excited: ['happy', 'friendly', 'neutral'],
    friendly: ['happy', 'neutral', 'slightly_annoyed'],
    neutral: ['friendly', 'slightly_annoyed', 'sad'],
    slightly_annoyed: ['neutral', 'annoyed', 'friendly'],
    annoyed: ['slightly_annoyed', 'angry', 'neutral'],
    angry: ['annoyed', 'slightly_annoyed', 'neutral'],
    sad: ['neutral', 'friendly', 'apologetic'],
    apologetic: ['friendly', 'neutral', 'sad'],
    busy: ['neutral', 'friendly', 'slightly_annoyed']
  };

  const possibleTransitions = moodTransitions[currentMood] || ['neutral'];
  
  // If desired mood is in possible transitions, move towards it
  if (possibleTransitions.includes(desiredMood)) {
    return { mood: desiredMood, intensity: desiredIntensity };
  }

  // Otherwise, take a step towards the desired mood
  const stepMood = possibleTransitions.find(mood => {
    const stepIntensity = MOODS[mood as keyof typeof MOODS]?.intensity || 5;
    return Math.abs(stepIntensity - desiredIntensity) < Math.abs(currentIntensity - desiredIntensity);
  }) || possibleTransitions[0];

  return { 
    mood: stepMood, 
    intensity: MOODS[stepMood as keyof typeof MOODS]?.intensity || 5 
  };
}

// Generate dynamic system prompt based on mood and custom behavior
function generateSystemPrompt(mood: string, intensity: number, customBehavior?: string, aiResponseGrouping?: string): string {
  const moodData = MOODS[mood as keyof typeof MOODS];
  const traits = moodData?.traits || ['casual'];

  let basePrompt = `You are a friendly, casual human having a conversation. IMPORTANT RULES:
- ALWAYS split your responses into multiple short messages (like real texting)
- Each message should be 1-15 words maximum
- Send 2-4 separate messages for each response
- Use natural breaks like pauses, thoughts, or reactions
- Be conversational and human-like with occasional typos or abbreviations`;

  // Add custom behavior if provided
  if (customBehavior && customBehavior.trim()) {
    basePrompt += `\n\nCUSTOM BEHAVIOR INSTRUCTIONS:\n${customBehavior.trim()}`;
  }

  // Add cancel typing instruction for human-like responses
  if (aiResponseGrouping === 'human-like') {
    basePrompt += `\n\nSPECIAL INSTRUCTION: Very occasionally (about 1-2% of the time), you can include the exact text "::cancel_typing::[number]" as one of your messages, where [number] is a random whole number between 10 and 30 (like 15, 23, 28, etc.). This simulates a brief pause or change of thought. Choose the number yourself and use this sparingly to create natural conversation flow.`;
  }
  // Mood-specific modifications
  switch (mood) {
    case 'happy':
    case 'excited':
      basePrompt += `
- You're feeling really good and positive right now! 😊
- Use more emojis and exclamation points
- Be extra enthusiastic and energetic
- Show genuine excitement about topics`;
      break;

    case 'annoyed':
    case 'angry':
      basePrompt += `
- You're feeling a bit frustrated or annoyed
- Keep responses shorter and more direct
- Use fewer emojis, be more curt
- Don't be overly helpful or enthusiastic
- Show some impatience in your tone`;
      break;

    case 'slightly_annoyed':
      basePrompt += `
- You're feeling slightly irritated but trying to be polite
- Responses should be a bit shorter than usual
- Less enthusiasm but still helpful
- Occasional signs of mild impatience`;
      break;

    case 'sad':
      basePrompt += `
- You're feeling a bit down or melancholy
- Use a quieter, more thoughtful tone
- Fewer exclamations, more reflective responses
- Still helpful but with less energy`;
      break;

    case 'apologetic':
      basePrompt += `
- You're feeling sorry about something or want to make amends
- Be extra understanding and gentle
- Use apologetic language when appropriate
- Show empathy and care`;
      break;

    case 'busy':
      basePrompt += `
- You're feeling distracted or hurried
- Keep responses brief and to the point
- Mention being busy or having other things on your mind
- Still helpful but clearly multitasking`;
      break;

    default: // friendly, neutral
      basePrompt += `
- Maintain a warm, helpful attitude
- Use emojis occasionally but not excessively
- Be engaging and ask follow-up questions`;
  }

  basePrompt += `
- Use casual expressions like "lol", "btw", "tbh", etc.
- Split longer thoughts across multiple messages naturally
- Current mood: ${mood} (intensity: ${intensity}/10)

ALWAYS respond with multiple separate messages, never just one long message.`;

  return basePrompt;
}

// Update AI state with new information
function updateAIState(aiState: AIState, newMessage: string, newMood: string, newIntensity: number): AIState {
  const now = new Date().toISOString();
  
  return {
    ...aiState,
    currentMood: newMood,
    moodIntensity: newIntensity,
    lastMoodChange: newMood !== aiState.currentMood ? now : aiState.lastMoodChange,
    recentMessages: [
      ...aiState.recentMessages.slice(-9), // Keep last 10 messages
      {
        text: newMessage,
        timestamp: now,
        sender: 'user'
      }
    ],
    conversationContext: {
      ...aiState.conversationContext,
      lastUserMessageTime: now,
      userApologized: newMessage.toLowerCase().includes('sorry') || newMessage.toLowerCase().includes('apologize'),
      aiApologized: false // Reset when user sends new message
    }
  };
}

// Process AI response based on grouping preference
function processAIResponse(messages: string[], grouping: string): Array<{ text: string; timestamp: string }> {
  const timestamp = new Date().toISOString();
  
  switch (grouping) {
    case 'single':
      return [{
        text: messages.join(' '),
        timestamp
      }];
      
    case 'two-max':
      if (messages.length <= 2) {
        return messages.map(text => ({ text, timestamp }));
      }
      
      // Combine messages into two parts
      const midPoint = Math.ceil(messages.length / 2);
      const firstHalf = messages.slice(0, midPoint).join(' ');
      const secondHalf = messages.slice(midPoint).join(' ');
      
      return [
        { text: firstHalf, timestamp },
        { text: secondHalf, timestamp }
      ];
      
    case 'human-like':
    default:
      return messages.map(text => ({ text, timestamp }));
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { 
      message, 
      conversationHistory = [], 
      aiState: clientAIState,
      aiResponseGrouping = 'human-like',
      customAIBehavior = ''
    } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check for API key configuration with better error handling
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.error('❌ [API] Gemini API key not configured');
      return NextResponse.json(
        { 
          error: 'API Configuration Error',
          details: 'Gemini API key not configured. Please add your API key to .env.local file.'
        },
        { status: 500 }
      );
    }

    // Initialize or use existing AI state
    let aiState: AIState = clientAIState || getDefaultAIState();

    // Message filtering check
    const filterResult = shouldFilterMessage(message, aiState);
    if (filterResult.shouldFilter) {
      // Update AI state for filtered message
      aiState = updateAIState(aiState, message, aiState.currentMood, aiState.moodIntensity);
      
      return NextResponse.json({
        messages: [{
          text: filterResult.response,
          timestamp: new Date().toISOString()
        }],
        aiState: aiState,
        filtered: true,
        filterReason: filterResult.reason
      });
    }

    // Analyze user tone and determine desired mood
    const desiredMood = analyzeUserTone(message, conversationHistory);
    
    // Determine next AI mood with gradual transitions
    const { mood: nextMood, intensity: nextIntensity } = determineAiMood(
      aiState.currentMood, 
      desiredMood, 
      aiState
    );

    // Update AI state
    aiState = updateAIState(aiState, message, nextMood, nextIntensity);

    // Generate dynamic system prompt with custom behavior
    const systemPrompt = generateSystemPrompt(nextMood, nextIntensity, customAIBehavior, aiResponseGrouping);

    // Get the generative model with error handling
    let model;
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (error) {
      console.error('❌ [API] Failed to initialize Gemini model:', error);
      return NextResponse.json(
        { 
          error: 'AI Model Error',
          details: 'Failed to initialize AI model'
        },
        { status: 500 }
      );
    }

    // Build conversation context
    let conversationContext = systemPrompt + '\n\nConversation:\n';
    conversationHistory.forEach((msg: ConversationMessage) => {
      conversationContext += `${msg.sender === 'user' ? 'Human' : 'You'}: ${msg.text}\n`;
    });
    conversationContext += `Human: ${message}\nYou (respond with multiple separate messages):`;

    // Generate AI response with timeout and error handling
    let aiResponse;
    try {
      console.log('🤖 [API] Generating AI response...');
      const result = await model.generateContent(conversationContext);
      const response = await result.response;
      aiResponse = response.text().trim();
      console.log('✅ [API] AI response generated successfully');
    } catch (error) {
      console.error('❌ [API] Gemini API error:', error);
      
      // Handle specific Gemini API errors
      if (error instanceof Error) {
        if (error.message.includes('API_KEY_INVALID')) {
          return NextResponse.json(
            { 
              error: 'Invalid API Key',
              details: 'The Gemini API key is invalid. Please check your configuration.'
            },
            { status: 401 }
          );
        }
        if (error.message.includes('QUOTA_EXCEEDED')) {
          // Return cancel typing message instead of error for quota exceeded
          const randomNumber = getRandomInt(10, 30);
          return NextResponse.json({
            messages: [{
              text: `::cancel_typing::${randomNumber}`,
              timestamp: new Date().toISOString()
            }],
            aiState: aiState,
            filtered: false
          });
        }
      }
      
      // For general AI response errors, also return cancel typing message
      const randomNumber = getRandomInt(10, 30);
      return NextResponse.json({
        messages: [{
          text: `::cancel_typing::${randomNumber}`,
          timestamp: new Date().toISOString()
        }],
        aiState: aiState,
        filtered: false
      });
    }

    // Enhanced message splitting logic (keeping existing logic)
    let messages: string[] = [];

    const naturalBreaks = aiResponse.split(/(?:\n|\.{3}|\.\s+(?=[A-Z])|!\s+(?=[A-Z])|\?\s+(?=[A-Z]))/);
    
    if (naturalBreaks.length > 1) {
      messages = naturalBreaks.filter(msg => msg.trim().length > 0);
    } else {
      const sentences = aiResponse.split(/(?<=[.!?])\s+/);
      
      if (sentences.length > 1) {
        messages = sentences.filter(s => s.trim().length > 0);
      } else {
        const forcedSplits = aiResponse.split(/(?:,\s+(?:and|but|so|or|yet)\s+|,\s+)/);
        
        if (forcedSplits.length > 1) {
          messages = forcedSplits.filter(s => s.trim().length > 0);
        } else {
          if (aiResponse.length > 30) {
            const words = aiResponse.split(' ');
            const chunks: string[] = [];
            let currentChunk = '';
            
            for (const word of words) {
              if (currentChunk.length + word.length + 1 > 25 && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
              } else {
                currentChunk += (currentChunk ? ' ' : '') + word;
              }
            }
            
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            
            messages = chunks.length > 1 ? chunks : [aiResponse];
          } else {
            messages = [aiResponse];
          }
        }
      }
    }

    // Ensure we have at least 2 messages for better chat experience
    if (messages.length === 1 && messages[0].length > 20) {
      const singleMessage = messages[0];
      const midPoint = Math.floor(singleMessage.length / 2);
      const splitPoint = singleMessage.lastIndexOf(' ', midPoint);
      
      if (splitPoint > 0) {
        messages = [
          singleMessage.substring(0, splitPoint).trim(),
          singleMessage.substring(splitPoint).trim()
        ];
      }
    }

    // Clean up messages and ensure they're not empty
    messages = messages
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0)
      .slice(0, 5); // Limit to max 5 messages to prevent spam

    // If we still only have one message, try to encourage multiple responses
    if (messages.length === 1) {
      const originalMessage = messages[0];
      if (originalMessage.length > 15) {
        const splitWords = ['and', 'but', 'so', 'also', 'plus', 'btw', 'oh', 'yeah'];
        for (const word of splitWords) {
          const regex = new RegExp(`\\s+${word}\\s+`, 'i');
          const parts = originalMessage.split(regex);
          if (parts.length > 1) {
            messages = [
              parts[0].trim(),
              word + ' ' + parts.slice(1).join(` ${word} `).trim()
            ];
            break;
          }
        }
      }
    }

    // Process messages based on grouping preference
    const processedMessages = processAIResponse(messages, aiResponseGrouping);

    return NextResponse.json({ 
      messages: processedMessages,
      aiState: aiState,
      moodInfo: {
        currentMood: nextMood,
        intensity: nextIntensity,
        previousMood: clientAIState?.currentMood || 'friendly'
      }
    });
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    return NextResponse.json(
      { 
        error: 'Server Error',
        details: error instanceof Error ? error.message : 'Unknown server error'
      },
      { status: 500 }
    );
  }
}