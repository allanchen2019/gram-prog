import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for frontend integration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// Helper to get Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

// Route: Health Check
app.get('/api/health', (req, res) => {
  const hasKey = getGeminiClient() !== null;
  res.json({
    status: 'ok',
    llmConfigured: hasKey,
    message: hasKey ? 'Backend is active and Gemini API is configured!' : 'Backend is active, but GEMINI_API_KEY is not configured yet.'
  });
});

// Route: Get Dynamic Gemini Models (curated list + dynamic API listing)
app.get('/api/models', async (req, res) => {
  const defaultModels = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast & Efficient)', series: '1.5' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep & Creative)', series: '1.5' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Next-gen Fast)', series: '2.5' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (GA Frontier)', series: '3.5' },
    { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro (Preview)', series: '3.5' }
  ];

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return res.json(defaultModels);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.json(defaultModels);
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      return res.json(defaultModels);
    }

    // Filter models that are gemini models and support text generation
    const fetchedModels = data.models
      .filter(m => {
        const name = m.name.toLowerCase();
        return name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent');
      })
      .map(m => {
        const rawName = m.name.replace('models/', '');
        let label = rawName;
        let series = 'Other';
        
        if (rawName.includes('3.5-flash')) {
          label = `Gemini 3.5 Flash (${m.displayName || 'Latest Fast'})`;
          series = '3.5';
        } else if (rawName.includes('3.5-pro')) {
          label = `Gemini 3.5 Pro (${m.displayName || 'Latest Deep'})`;
          series = '3.5';
        } else if (rawName.includes('2.5-flash')) {
          label = `Gemini 2.5 Flash (${m.displayName || 'Next-gen'})`;
          series = '2.5';
        } else if (rawName.includes('1.5-flash')) {
          label = `Gemini 1.5 Flash (${m.displayName || 'Fast'})`;
          series = '1.5';
        } else if (rawName.includes('1.5-pro')) {
          label = `Gemini 1.5 Pro (${m.displayName || 'Pro'})`;
          series = '1.5';
        } else {
          label = m.displayName || rawName;
        }

        return {
          value: rawName,
          label: label,
          series: series
        };
      });

    // Merge dynamic and default models, keeping unique value keys
    const allModelsMap = new Map();
    defaultModels.forEach(m => allModelsMap.set(m.value, m));
    fetchedModels.forEach(m => allModelsMap.set(m.value, m));

    res.json(Array.from(allModelsMap.values()));
  } catch (error) {
    console.error('Error fetching dynamic models:', error);
    res.json(defaultModels);
  }
});

// Route: Core grammar & spelling check
app.post('/api/check', async (req, res) => {
  const { text, options = {}, model: requestedModel } = req.body;

  if (!text || text.trim() === '') {
    return res.json([]);
  }

  // Dynamic whitelist: allow any model starting with 'gemini'
  const modelName = (requestedModel && requestedModel.startsWith('gemini'))
    ? requestedModel
    : 'gemini-flash-lite-latest';

  const client = getGeminiClient();
  if (!client) {
    return res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API Key is missing. Please add your GEMINI_API_KEY to backend/.env to enable AI checks.'
    });
  }

  try {
    const defaultOptions = { spelling: true, grammar: true, clarity: true, tone: true };
    const mergedOptions = { ...defaultOptions, ...options };

    // Define response schema to guarantee structured JSON output from Gemini
    const responseSchema = {
      type: SchemaType.ARRAY,
      description: 'List of language correction and style enhancement suggestions',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'Unique string ID for the suggestion (e.g. c1, c2)' },
          start: { type: SchemaType.INTEGER, description: 'The exact starting 0-indexed character index in the original text' },
          end: { type: SchemaType.INTEGER, description: 'The exact ending 0-indexed character index in the original text' },
          original: { type: SchemaType.STRING, description: 'The exact original word or phrase with the issue' },
          suggestion: { type: SchemaType.STRING, description: 'The recommended correction or phrasing' },
          category: { 
            type: SchemaType.STRING, 
            description: 'The category of the issue: spelling, grammar, clarity, or tone'
          },
          explanation: { type: SchemaType.STRING, description: 'A short, elegant, educational explanation of the suggestion' }
        },
        required: ['id', 'start', 'end', 'original', 'suggestion', 'category', 'explanation']
      }
    };

    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // low temperature for highly consistent factual corrections
      }
    });

    const prompt = `Analyze the following English text for writing suggestions.
Only check categories specified here:
${mergedOptions.spelling ? '- Spelling: detect spelling mistakes.' : ''}
${mergedOptions.grammar ? '- Grammar: detect grammatical errors (tense, subject-verb agreement, prepositions, structure, punctuation).' : ''}
${mergedOptions.clarity ? '- Clarity & Style: detect wordy phrases, passive voice, awkward or overly complex sentence constructions.' : ''}
${mergedOptions.tone ? '- Tone & Politeness: detect mismatching tone, overly harsh language, or words that sound awkward for general communication.' : ''}

Original Text to analyze:
"""
${text}
"""

Instructions:
1. Locate every genuine spelling, grammar, clarity, or tone issue.
2. For each issue, identify the exact 0-indexed "start" and "end" character indices in the original text string.
3. Provide the "original" substring, the corrected "suggestion", the "category", and an educational "explanation".
4. Ensure character indices are mathematically precise relative to the original text. Double check character counts before final response.
5. If the text is perfectly correct, return an empty array [].`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse structured JSON response
    const suggestions = JSON.parse(responseText);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error during grammar check:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to process text checker. Please try again.',
      details: error.message
    });
  }
});

// Route: Minimal Correction (Step 1 & 2 of Accept All)
app.post('/api/correct-minimal', async (req, res) => {
  const { text, model: requestedModel } = req.body;

  if (!text || text.trim() === '') {
    return res.json({ rewrittenText: '', explanation: 'Empty text' });
  }

  const modelName = (requestedModel && requestedModel.startsWith('gemini'))
    ? requestedModel
    : 'gemini-flash-lite-latest';

  const client = getGeminiClient();
  if (!client) {
    return res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API Key is missing. Please add your GEMINI_API_KEY to backend/.env to enable AI checks.'
    });
  }

  try {
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        rewrittenText: { type: SchemaType.STRING, description: 'The corrected text with absolute minimal changes' },
        explanation: { type: SchemaType.STRING, description: 'A brief log of spelling and grammar corrections made' }
      },
      required: ['rewrittenText', 'explanation']
    };

    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.0, // lowest temperature for deterministic, minimal corrections
      }
    });

    const prompt = `Task: Perform absolute minimal spelling and grammar corrections on the following text.
Rules:
1. Fix all spelling, typo, and grammar errors.
2. Keep edits to the absolute minimum possible. Do not rewrite sentences, change vocabulary, or alter the tone, content, or style of the original unless strictly required to correct a syntax or spelling issue.
3. Absolutely do NOT add or delete any core content or information.

Original Text:
"""
${text}
"""

Provide the output in the requested JSON structure.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const rewriteResult = JSON.parse(responseText);
    res.json(rewriteResult);
  } catch (error) {
    console.error('Error during minimal correction:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to correct text minimally. Please try again.',
      details: error.message
    });
  }
});

// Route: Text Tone Rewriter
app.post('/api/rewrite', async (req, res) => {
  const { text, tone, model: requestedModel } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required for rewriter' });
  }
  if (!tone) {
    return res.status(400).json({ error: 'Tone is required for rewriter' });
  }

  // Dynamic whitelist: allow any model starting with 'gemini'
  const modelName = (requestedModel && requestedModel.startsWith('gemini'))
    ? requestedModel
    : 'gemini-flash-lite-latest';

  const client = getGeminiClient();
  if (!client) {
    return res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API Key is missing. Please add your GEMINI_API_KEY to backend/.env to enable AI checks.'
    });
  }

  try {
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        rewrittenText: { type: SchemaType.STRING, description: 'The fully rewritten version of the text in the requested tone' },
        explanation: { type: SchemaType.STRING, description: 'A short explanation describing the primary changes made to match the tone' }
      },
      required: ['rewrittenText', 'explanation']
    };

    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.7, // slightly higher temperature for creative style shifting
      }
    });

    const prompt = `Rewrite the following English text to sound distinctly "${tone}". Maintain the core meaning but transform the sentence structure, vocabulary, and flow to match the style of "${tone}".

Original Text:
"""
${text}
"""

Provide the output in the requested JSON structure.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const rewriteResult = JSON.parse(responseText);
    res.json(rewriteResult);
  } catch (error) {
    console.error('Error during text rewrite:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to rewrite text. Please try again.',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] gram-prog backend is running on http://localhost:${PORT}`);
});
