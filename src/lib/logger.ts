// Logging utility for Hardcore mode
export type HardcoreLog = {
    mode: 'hardcore';
    step_1_plan_latency_ms?: number;
    step_2_draft_latency_ms?: number;
    step_3_review_latency_ms?: number;
    step_4_fallback_latency_ms?: number;
    confidence_score?: number;
    fallback_triggered: boolean;
    total_tokens_approx?: number;
    provider: 'deepseek' | 'gpt-fallback';
    error?: string;
};

export function logHardcore(log: HardcoreLog) {
    const debugMode = process.env.DEBUG_HARDCORE === 'true';

    if (debugMode) {
        console.log('[HARDCORE DEBUG]', JSON.stringify(log, null, 2));
    } else {
        console.log('[HARDCORE]', {
            confidence: log.confidence_score,
            fallback: log.fallback_triggered,
            provider: log.provider,
        });
    }
}
