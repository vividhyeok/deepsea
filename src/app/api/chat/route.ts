
import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, openAIFetch, Message } from '@/lib/ai-providers';
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
        let mode: Mode = reqMode || 'standard';
        if (mode === 'auto') {
            // Auto can only return 'lite' or 'standard', never 'hardcore'
            mode = detectMode(lastMessage.content, 'auto');
        }

        const finalMessages: Message[] = [...messages];

        // ==================== MODE ROUTING ====================

        if (mode === 'hardcore') {
            // HARDCORE MODE: Use OpenAI GPT-4 with single-call prompt
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.hardcore_gpt });
            }

            // @ts-ignore
            const stream = await openAIFetch(finalMessages, 'gpt-4o', 0.7);

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });

        } else if (mode === 'lite') {
            // LITE MODE: Use DeepSeek
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.lite });
            }

        } else if (mode === 'standard') {
            // STANDARD MODE: Use DeepSeek
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.standard });
            }
        }

        // All non-hardcore modes use DeepSeek
        const currentModel = model || 'deepseek-chat';
        // @ts-ignore
        const stream = await deepSeekFetch(finalMessages, currentModel);

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
