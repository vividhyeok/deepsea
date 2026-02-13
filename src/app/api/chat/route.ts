
import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, Message } from '@/lib/ai-providers';
import { detectMode, SYSTEM_PROMPTS, Mode } from '@/lib/modes';
import { verifyJWT } from '@/lib/jwt';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const token = req.cookies.get('token')?.value;
        if (!token || !(await verifyJWT(token))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages, mode: reqMode, model } = await req.json();
        const lastMessage = messages[messages.length - 1];

        // Server-side mode enforcement
        let mode: Mode = reqMode || 'auto';
        if (mode === 'auto') {
            mode = detectMode(lastMessage.content, 'auto');
            console.log(`[AUTO] Detected mode: ${mode} (input length: ${lastMessage.content.length})`);
        }

        const finalMessages: Message[] = [...messages];

        // Add system prompt based on mode
        const systemPrompt = SYSTEM_PROMPTS[mode];
        if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
            finalMessages.unshift({ role: 'system', content: systemPrompt });
        }

        // Single DeepSeek call for all modes
        const currentModel = model || 'deepseek-chat';
        // @ts-ignore
        const stream = await deepSeekFetch(finalMessages, currentModel);

        console.log(`[${mode.toUpperCase()}] Request processed`);

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
