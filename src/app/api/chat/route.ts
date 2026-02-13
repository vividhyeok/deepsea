
import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, deepSeekFetchNonStream, openAIFetchNonStream, Message } from '@/lib/ai-providers';
import { detectMode, SYSTEM_PROMPTS, Mode, PlanResult, ReviewResult, shouldFallback } from '@/lib/modes';
import { verifyJWT } from '@/lib/jwt';
import { logHardcore } from '@/lib/logger';

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

// ==================== HARDCORE MODE (3.5-Step DeepSeek + GPT Fallback) ====================

async function executeHardcoreMode(messages: Message[], userInput: string, model: string) {
    const log: any = {
        mode: 'hardcore',
        fallback_triggered: false,
        provider: 'deepseek',
    };

    try {
        const startTime = Date.now();

        // Step 1: PLAN (DeepSeek, JSON output, max 200 tokens)
        const step1Start = Date.now();
        const planPrompt = SYSTEM_PROMPTS.hardcore_plan.replace('{user_input}', userInput);
        const planOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: planPrompt }],
            model,
            0.7,
            200
        );
        log.step_1_plan_latency_ms = Date.now() - step1Start;

        // Parse Plan JSON
        let plan: PlanResult;
        try {
            plan = JSON.parse(planOutput);
        } catch (e) {
            // Fallback if JSON parsing fails
            plan = {
                task_type: 'mixed',
                steps: ['Analyze query', 'Generate answer'],
                risk_flags: ['factual_uncertainty'],
            };
        }

        // Step 2: DRAFT (DeepSeek, full answer, max 1000 tokens)
        const step2Start = Date.now();
        const draftPrompt = SYSTEM_PROMPTS.hardcore_draft
            .replace('{user_input}', userInput)
            .replace('{plan_output}', JSON.stringify(plan, null, 2));
        const draftOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: draftPrompt }],
            model,
            0.7,
            1000
        );
        log.step_2_draft_latency_ms = Date.now() - step2Start;

        // Step 3: REVIEW + CONFIDENCE (DeepSeek, JSON output, max 300 tokens)
        const step3Start = Date.now();
        const reviewPrompt = SYSTEM_PROMPTS.hardcore_review
            .replace('{user_input}', userInput)
            .replace('{draft_output}', draftOutput);
        const reviewOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: reviewPrompt }],
            model,
            0.7,
            300
        );
        log.step_3_review_latency_ms = Date.now() - step3Start;

        // Parse Review JSON
        let review: ReviewResult;
        try {
            review = JSON.parse(reviewOutput);
        } catch (e) {
            // Fallback if JSON parsing fails (assume high confidence)
            review = {
                logical_consistency: 0.8,
                numerical_correctness: 0.8,
                factual_reliability: 0.8,
                completeness: 0.8,
                confidence_score: 0.8,
                risk_flags: [],
                needs_fallback: false,
                fallback_reason: null,
            };
        }

        log.confidence_score = review.confidence_score;

        // Step 4: CONDITIONAL FALLBACK (GPT if needed)
        let finalAnswer = draftOutput;

        if (shouldFallback(review, plan)) {
            log.fallback_triggered = true;
            log.provider = 'gpt-fallback';

            const step4Start = Date.now();
            const fallbackPrompt = SYSTEM_PROMPTS.hardcore_gpt_fallback
                .replace('{user_input}', userInput)
                .replace('{draft_output}', draftOutput)
                .replace('{review_output}', JSON.stringify(review, null, 2));

            finalAnswer = await openAIFetchNonStream(
                [{ role: 'user', content: fallbackPrompt }],
                'gpt-4o',
                0.7
            );
            log.step_4_fallback_latency_ms = Date.now() - step4Start;
        }

        // Log performance
        logHardcore(log);

        // Stream final answer to user
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const data = JSON.stringify({
                    choices: [{ delta: { content: finalAnswer } }]
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

    } catch (error: any) {
        console.error('Hardcore mode error:', error);
        log.error = error.message;
        logHardcore(log);

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
