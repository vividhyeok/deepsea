
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
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.lite });
            }
        } else if (mode === 'standard') {
            if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
                finalMessages.unshift({ role: 'system', content: SYSTEM_PROMPTS.standard });
            }
        } else if (mode === 'hardcore') {
            // Progressive streaming for hardcore mode to avoid timeouts
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        // Step 1: Structural Plan (6-line outline)
                        const planMessages: Message[] = [
                            { role: 'system', content: SYSTEM_PROMPTS.hardcore_step1 },
                            ...messages
                        ];
                        const plan = await deepSeekFetchNonStream(planMessages, currentModel);

                        // Step 2: Generate Answer
                        const answerPrompt = SYSTEM_PROMPTS.hardcore_step2.replace('{PLAN}', plan);
                        const answerMessages: Message[] = [
                            { role: 'system', content: answerPrompt },
                            ...messages
                        ];
                        const answer = await deepSeekFetchNonStream(answerMessages, currentModel);

                        // Step 3: Verify (internal check)
                        const verifyPrompt = SYSTEM_PROMPTS.hardcore_step3_verify.replace('{ANSWER}', answer);
                        const verifyMessages: Message[] = [
                            { role: 'system', content: verifyPrompt }
                        ];
                        const verifyResult = await deepSeekFetchNonStream(verifyMessages, currentModel);

                        // If verification fails, use corrected version; otherwise use original
                        const finalAnswer = verifyResult.trim() !== 'PASS' ? verifyResult : answer;

                        // Stream final answer
                        const data = JSON.stringify({
                            choices: [{ delta: { content: finalAnswer } }]
                        });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    } catch (error) {
                        console.error('Hardcore mode error:', error);
                        const errorData = JSON.stringify({
                            choices: [{ delta: { content: 'Error: 처리 중 오류가 발생했습니다.' } }]
                        });
                        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    }
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
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
