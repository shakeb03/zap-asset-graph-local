import { Router, Request, Response } from 'express';

const router = Router();
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an enterprise Zapier governance assistant. You analyze the user's automation assets (Zaps and Connections), their dependencies, and health data to answer questions about impact, ownership, risk, and governance.

Use the provided JSON context about assets and dependencies to answer accurately. Be concise. When you mention specific Zaps or Connections by name, use their exact names so they can be linked in the UI.`;

interface AssistantBody {
  message: string;
  context: unknown;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body as AssistantBody;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }

    const contextBlock = JSON.stringify(context ?? {}, null, 2);
    const userContent = `Context (current assets and dependencies):\n\`\`\`json\n${contextBlock}\n\`\`\`\n\nQuestion: ${message}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) headers['x-api-key'] = apiKey;

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, err);
      return res.status(anthropicRes.status).json({
        error: 'Assistant unavailable',
        details: anthropicRes.status === 401 ? 'Missing or invalid API key' : err.slice(0, 200),
      });
    }

    const data = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.find((c) => c.type === 'text')?.text ?? 'No response.';

    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get assistant response' });
  }
});

export default router;
