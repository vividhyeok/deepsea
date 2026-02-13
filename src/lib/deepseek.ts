
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export async function deepSeekFetch(messages: Message[], model: string, temperature: number = 0.7) {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            stream: true,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API Error: ${error}`);
    }

    return response.body;
}

// Non-streaming fetch for internal steps
export async function deepSeekFetchNonStream(messages: Message[], model: string, temperature: number = 0.7): Promise<string> {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            stream: false,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API Error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}
