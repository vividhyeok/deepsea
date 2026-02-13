
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
        const startTime = Date.now();

        // Step 1: PLAN (DeepSeek, JSON output, max 150 tokens)
        const planPrompt = SYSTEM_PROMPTS.hardcore_plan.replace('{user_input}', userInput);
        const planOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: planPrompt }],
            model,
            0.7,
            150
        );

        // Parse Plan JSON
        let plan: PlanResult;
        try {
            plan = JSON.parse(planOutput);
        } catch (e) {
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

        // Step 2: DRAFT (DeepSeek, full answer, max 800 tokens)
        const draftPrompt = SYSTEM_PROMPTS.hardcore_draft
            .replace('{user_input}', userInput)
            .replace('{plan_output}', JSON.stringify(plan, null, 2));
        const draftOutput = await deepSeekFetchNonStream(
            [{ role: 'user', content: draftPrompt }],
            model,
            0.7,
            800
        );

        // Step 3: REWRITE (DeepSeek, streaming)
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

        // Log performance
        const totalTime = Date.now() - startTime;
        console.log('[HARDCORE]', {
            steps: 3,
            total_time_ms: totalTime,
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
        console.error('Hardcore mode error:', error);

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
