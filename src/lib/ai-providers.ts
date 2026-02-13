export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === 'REQUEST_TIMEOUT' || error.name === 'TimeoutError' || error.name === 'AbortError';
}

async function deepSeekRequest(payload: object, timeoutMs: number) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API Error: ${error}`);
    }

    return response;
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      throw new Error('REQUEST_TIMEOUT');
    }
    throw error;
  }
}

export async function deepSeekFetch(
  messages: Message[],
  model: string,
  options: DeepSeekOptions = {}
) {
  const { temperature = 0.35, maxTokens = 820, timeoutMs = 22000 } = options;

  const response = await deepSeekRequest(
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    },
    timeoutMs
  );

  if (!response.body) {
    throw new Error('No response body from DeepSeek API');
  }

  return response.body;
}

export async function deepSeekFetchNonStream(
  messages: Message[],
  model: string,
  options: DeepSeekOptions = {}
): Promise<string> {
  const { temperature = 0.35, maxTokens = 520, timeoutMs = 18000 } = options;

  const response = await deepSeekRequest(
    {
      model,
      messages,
      temperature,
      stream: false,
      max_tokens: maxTokens,
    },
    timeoutMs
  );

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
