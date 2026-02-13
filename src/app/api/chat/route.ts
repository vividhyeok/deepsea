
import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, deepSeekFetchNonStream, Message } from '@/lib/ai-providers';
import { detectMode, SYSTEM_PROMPTS, Mode, PlanResult } from '@/lib/modes';
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
            mode = detectMode(lastMessage.content, 'auto');
        }

        const finalMessages: Message[] = [...messages];

        // ==================== MODE ROUTING ====================

        if (mode === 'hardcore') {
            return await executeHardcoreMode(messages, lastMessage.content, model || 'deepseek-chat');
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

// ==================== HARDCORE MODE (3-Step: Plan → Draft → Rewrite) ====================

async function executeHardcoreMode(messages: Message[], userInput: string, model: string) {
    try {
        const totalStartTime = Date.now();
        console.log('[HARDCORE] Starting execution...');

        // Step 1: PLAN (DeepSeek, JSON output, max 150 tokens)
        const step1Start = Date.now();
        const planPrompt = SYSTEM_PROMPTS.hardcore_plan.replace('{user_input}', userInput);
        const planOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: planPrompt }],
            model,
            0.7,
            150
        );
        const step1Latency = Date.now() - step1Start;
        console.log(`[HARDCORE] Step 1 (Plan): ${step1Latency}ms`);

        // Parse Plan JSON
        let plan: PlanResult;
        try {
            plan = JSON.parse(planOutput);
        } catch (e) {
            console.warn('[HARDCORE] Plan JSON parse failed, using fallback');
            // Fallback if JSON parsing fails
            plan = {
                task_type: 'explanation',
                complexity_level: 'medium',
                required_elements: ['Core explanation', 'Examples'],
                answer_outline: ['Introduction', 'Main content', 'Conclusion'],
                risk_areas: [],
                missing_information: [],
            };
        }

        // Step 2: DRAFT (DeepSeek, full answer, max 600 tokens - reduced from 800)
        const step2Start = Date.now();
        const draftPrompt = SYSTEM_PROMPTS.hardcore_draft
            .replace('{user_input}', userInput)
            .replace('{plan_output}', JSON.stringify(plan, null, 2));
        const draftOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: draftPrompt }],
            model,
            0.7,
            600  // Reduced from 800 to speed up
        );
        const step2Latency = Date.now() - step2Start;
        console.log(`[HARDCORE] Step 2 (Draft): ${step2Latency}ms`);

        // Check if we're approaching timeout
        const elapsedBeforeRewrite = Date.now() - totalStartTime;
        console.log(`[HARDCORE] Elapsed before Rewrite: ${elapsedBeforeRewrite}ms`);

        if (elapsedBeforeRewrite > 8000) {
            // If already over 8 seconds, skip Rewrite and return Draft
            console.warn('[HARDCORE] Timeout risk detected, returning Draft directly');
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    const data = JSON.stringify({
                        choices: [{ delta: { content: draftOutput } }]
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
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

        // Step 3: REWRITE (DeepSeek, streaming)
        const step3Start = Date.now();
        const rewritePrompt = SYSTEM_PROMPTS.hardcore_rewrite
            .replace('{user_input}', userInput)
            .replace('{plan_output}', JSON.stringify(plan, null, 2))
            .replace('{draft_output}', draftOutput);

        // @ts-ignore
        const stream = await deepSeekFetch(
            [{ role: 'user', content: rewritePrompt }],
            model,
            0.7
        );

        // Log total time (approximate, since Rewrite is streaming)
        const totalTime = Date.now() - totalStartTime;
        console.log(`[HARDCORE] Step 3 (Rewrite) started at: ${Date.now() - step3Start}ms`);
        console.log(`[HARDCORE] Total time before streaming: ${totalTime}ms`);
        console.log(`[HARDCORE] Summary:`, {
            step_1_plan_ms: step1Latency,
            step_2_draft_ms: step2Latency,
            total_before_stream_ms: totalTime,
            task_type: plan.task_type,
            complexity: plan.complexity_level,
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('[HARDCORE] Error:', error);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const errorData = JSON.stringify({
                    choices: [{ delta: { content: `Error: ${error.message || '처리 중 오류가 발생했습니다.'}` } }]
                });
                controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
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
}
