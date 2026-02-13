
import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, deepSeekFetchNonStream, Message } from '@/lib/deepseek';
import { detectMode, SYSTEM_PROMPTS, Mode } from '@/lib/modes';
import { verifyJWT } from '@/lib/jwt';

export const runtime = 'edge'; // Optional: Use edge if compatible with jose/fetch

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const token = req.cookies.get('token')?.value;
        if (!token || !(await verifyJWT(token))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages, mode: reqMode, model } = await req.json();
        const lastMessage = messages[messages.length - 1];

        // Determine effective mode
        let mode: Mode = reqMode || 'standard';
        if (mode === 'auto') {
            mode = detectMode(lastMessage.content, 'auto');
        }

        const currentModel = model || 'deepseek-chat';
        const finalMessages: Message[] = [...messages];

        // Mode Logic
        if (mode === 'lite') {
            // Direct pass-through, no system prompt override unless empty
            // Actually, Lite usually means "just the raw model behavior" or minimal interference.
            // We'll leave messages as is.
        } else if (mode === 'standard') {
            // Prepend system prompt if not present? Or just add it.
            // Usually system prompt should be first.
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.standard });
            }
        } else if (mode === 'hardcore') {
            // Step 1: Internal Plan
            // We need a separate chain for planning.
            const planMessages: Message[] = [
                { role: 'system', content: SYSTEM_PROMPTS.hardcore_step1 },
                ...messages
            ];

            // Non-streaming call for plan
            const plan = await deepSeekFetchNonStream(planMessages, currentModel);

            // Step 2: Answer with Plan
            // We inject the plan into the system prompt for the final answer
            const systemPrompt = SYSTEM_PROMPTS.hardcore_step2.replace('{PLAN}', plan);

            // Reset messages for the final call, but with the new system prompt
            // We should construct the final context.
            finalMessages.unshift({ role: 'system', content: systemPrompt });
        }

        // Main Streaming Call
        // @ts-ignore
        const stream = await deepSeekFetch(finalMessages, currentModel);

        // Create a new stream that we can pipe through to standard response
        // DeepSeek returns OpenAI-compatible SSE chunks "data: {...}"
        // We can just pipe specific chunks or just pass-through.
        // User requested "stream proxy".

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
