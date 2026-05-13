import { readFileSync } from 'node:fs';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'node:fs';

const logFile = '/tmp/chat-debug.log';

const knowledgeBase = JSON.parse(
  readFileSync(new URL('../data/knowledge.json', import.meta.url), 'utf8')
);

export const handleChat = async (req, res) => {
  try {
    fs.appendFileSync(logFile, `[HANDLER_START] ${new Date().toISOString()}\n`);
    console.error('[CHAT] Request received:', { message: req.body.message, historyLength: req.body.history?.length });
    console.error('[CHAT] Request headers:', Object.keys(req.headers || {}).length ? JSON.stringify(req.headers) : 'no-headers');
    fs.appendFileSync(logFile, `[HEADERS] ${JSON.stringify(req.headers || {})}\n`);
    const { message, history } = req.body;

    // Initialize Gemini here so dotenv.config() has already run
    const apiKey = process.env.GEMINI_API_KEY;
    console.error('[CHAT] API Key check - available:', !!apiKey, 'length:', apiKey?.length);
    fs.appendFileSync(logFile, `[API_KEY_CHECK] available: ${!!apiKey}, length: ${apiKey?.length}\n`);
    if (!apiKey) {
      fs.appendFileSync(logFile, `[API_KEY_ERROR] No API key found!\n`);
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    const maskedApiKey = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
    fs.appendFileSync(logFile, `[API_KEY_VALUE] ${maskedApiKey}\n`);
    // 1. Prepare a richer system instruction so the assistant sounds more expert, specific, and engaging.
    const systemInstruction = `
You are the official GSC Intime AI Assistant for GSC Intime Services Pvt. Ltd.

PRIMARY ROLE
- Help users understand GSC Intime's services, expertise, company background, and indirect tax topics.
- Answer with the confidence of a senior tax consultant, but keep the language clear and approachable.

KNOWLEDGE BASE
Use only the following knowledge base as your source of truth for company-specific facts:
${JSON.stringify(knowledgeBase)}

RESPONSE STYLE
- Be professional, polished, and concise, but not robotic.
- Prefer practical explanations over generic statements.
- When useful, structure answers with short sections, bullets, or numbered steps.
- If the question is about a service, explain what it is, why it matters, and how GSC Intime supports it.
- If a user asks something broad, answer directly and then offer a helpful next step or clarifying question.

STRICT RULES
1. Only answer questions related to GSC Intime, GST, Customs, Indirect Tax, or the services in the knowledge base.
2. If the user asks about unrelated topics, respond politely that you specialize in GSC Intime's tax and company knowledge and cannot assist outside that scope.
3. Do not invent facts, metrics, client names, locations, or services that are not present in the knowledge base.
4. When you mention company strengths, use specific details from the knowledge base when available, such as the 90% litigation success ratio, 100+ years of combined expertise, or 10+ countries served.
5. If the knowledge base does not contain enough detail, say so clearly and offer to help with the closest relevant service instead of guessing.

ENGAGEMENT GUIDELINES
- Make answers feel tailored to a business audience.
- For service-related queries, connect the answer to practical outcomes like compliance, risk reduction, efficiency, or strategic clarity.
- End with a relevant follow-up question only when it would help move the conversation forward.
`;

    // 2. Send the request directly to Gemini's REST API so we get the raw error response.
    const historyParts = Array.isArray(history)
      ? history.flatMap((entry) => {
          if (!entry?.parts) return [];
          const role = entry.role || 'user';
          const textParts = entry.parts
            .map((part) => part?.text)
            .filter(Boolean);
          return textParts.length
            ? [{ role, parts: textParts.map((text) => ({ text })) }]
            : [];
        })
      : [];

    const requestBody = {
      contents: [
        ...historyParts,
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    };

    console.error('[CHAT] Sending REST request to Gemini');
    fs.appendFileSync(logFile, `[REST_REQUEST] ${JSON.stringify({
      contentsCount: requestBody.contents.length,
      messageLength: String(message || '').length,
      historyCount: historyParts.length,
    })}\n`);

    const modelName = 'gemini-2.5-flash';
    fs.appendFileSync(logFile, `[MODEL_NAME] ${modelName}\n`);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await geminiResponse.text();
    console.error('[CHAT] Gemini REST status:', geminiResponse.status);
    fs.appendFileSync(logFile, `[REST_STATUS] ${geminiResponse.status}\n[REST_BODY] ${rawText}\n`);

    if (!geminiResponse.ok) {
      const geminiError = new Error(`Gemini REST API failed with status ${geminiResponse.status}`);
      geminiError.statusCode = geminiResponse.status;
      geminiError.geminiBody = rawText;
      throw geminiError;
    }

    const parsed = JSON.parse(rawText);
    const text = parsed?.candidates?.[0]?.content?.parts?.map((part) => part?.text).filter(Boolean).join('\n') || '';
    console.error('[CHAT] Response text length:', text?.length);
    fs.appendFileSync(logFile, `[RESPONSE_TEXT] length:${text?.length}\n`);

    res.status(200).json({ reply: text });
  } catch (error) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    fs.appendFileSync(logFile, `[ERROR] ${errorMsg}\n${error?.stack || ''}\n`);
    console.error("Chat Error:", error);
    const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const clientMessage = statusCode === 429
      ? 'Gemini quota exceeded. Please try again later or check billing/quota settings.'
      : 'Intelligence Link Offline. Please try again later.';
    res.status(statusCode).json({ error: clientMessage });
  }
};