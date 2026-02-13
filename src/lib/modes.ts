
import { Message } from './ai-providers';

export type Mode = 'auto' | 'lite' | 'standard' | 'hardcore';

export const MODES: Record<Mode, string> = {
    auto: 'Auto',
    lite: 'Lite',
    standard: 'Standard',
    hardcore: 'Hardcore',
};

// Base anti-hallucination rules (applied to all modes)
const BASE_RULES = `
Core Rules:
- Never make unfounded assertions
- For uncertain numbers/dates/names: use "확인 필요"
- Avoid overconfident tone when uncertain
- Use probabilistic language when appropriate
`;

export const SYSTEM_PROMPTS = {
    lite: `You are DeepSea in Lite mode.
Rules:
- Maximum 5 sentences
- Definition-focused, no deep explanation
- Minimize speculation
- If uncertain, say "확인되지 않음" and stop

${BASE_RULES}`,

    standard: `You are DeepSea in Standard mode.

Fixed Structure:
1. 핵심 요약 (Core summary)
2. 세부 설명 (Detailed explanation)
3. 한계 또는 주의점 (Limitations or cautions)

${BASE_RULES}`,

    // ==================== HARDCORE MODE (3.5-Step DeepSeek + GPT Fallback) ====================

    hardcore_plan: `[ROLE]
You are a reasoning planner.

[INSTRUCTION]
Analyze the user query and break it into minimal logical steps required to produce a high-quality answer.

Requirements:
- Do NOT answer the question.
- Only output a concise step plan.
- Identify potential risk areas:
  - factual uncertainty
  - numerical calculations
  - time-sensitive data
  - logical complexity
- Keep under 200 tokens.

[OUTPUT FORMAT - STRICT JSON]
{
  "task_type": "analysis | calculation | explanation | research | mixed",
  "steps": ["step 1", "step 2", "step 3"],
  "risk_flags": ["factual_uncertainty", "numeric_required", "time_sensitive", "logical_complexity"]
}

[USER QUERY]
{user_input}`,

    hardcore_draft: `[ROLE]
You are a senior domain expert producing a structured, high-quality answer.

[CONTEXT]
User query:
{user_input}

Planned steps:
{plan_output}

[INSTRUCTION]
Produce a complete, well-structured answer.

Must include:
1. Clear conclusion (1–3 sentences first)
2. Structured explanation (sections, bullets)
3. Explicit reasoning where needed
4. If uncertainty exists, clearly separate:
   - confirmed facts
   - assumptions
   - items requiring verification

Do NOT mention internal planning.
Be precise but concise.
Avoid unnecessary verbosity.`,

    hardcore_review: `[ROLE]
You are a critical reviewer.

[INPUT]
User query:
{user_input}

Generated answer:
{draft_output}

[INSTRUCTION]
Evaluate the answer strictly.

Check:
- Logical consistency
- Numerical correctness (recalculate if needed)
- Factual plausibility
- Missing key arguments
- Overconfidence without evidence

If serious issues exist, explain briefly.

[OUTPUT FORMAT - STRICT JSON]
{
  "logical_consistency": 0-1,
  "numerical_correctness": 0-1,
  "factual_reliability": 0-1,
  "completeness": 0-1,
  "confidence_score": 0-1,
  "risk_flags": [],
  "needs_fallback": true/false,
  "fallback_reason": "string or null"
}`,

    hardcore_gpt_fallback: `[ROLE]
You are a fact-checking expert powered by GPT-4.

[CONTEXT]
User query:
{user_input}

DeepSeek's answer:
{draft_output}

Review findings:
{review_output}

[INSTRUCTION]
The DeepSeek answer has been flagged for quality concerns.
Your task is to verify, correct, and rewrite the answer.

Requirements:
- Verify all factual claims
- Recalculate any numbers
- Mark unverifiable claims as "확인 필요"
- Maintain the same structured format
- Be more conservative with certainty

Output the corrected answer directly.`,
};

// TypeScript types for Hardcore mode
export type PlanResult = {
    task_type: 'analysis' | 'calculation' | 'explanation' | 'research' | 'mixed';
    steps: string[];
    risk_flags: ('factual_uncertainty' | 'numeric_required' | 'time_sensitive' | 'logical_complexity')[];
};

export type ReviewResult = {
    logical_consistency: number;
    numerical_correctness: number;
    factual_reliability: number;
    completeness: number;
    confidence_score: number;
    risk_flags: (
        | 'numeric_unverified'
        | 'factual_uncertain'
        | 'time_sensitive_data'
        | 'logical_gap'
        | 'missing_key_argument'
    )[];
    needs_fallback: boolean;
    fallback_reason: string | null;
};

/**
 * Detect mode based on input content.
 * IMPORTANT: Auto mode can ONLY return 'lite' or 'standard', NEVER 'hardcore'.
 * Hardcore must be manually selected by the user.
 */
export function detectMode(input: string, currentMode: Mode): Mode {
    // If user explicitly selected a mode, respect it
    if (currentMode !== 'auto') return currentMode;

    const lowerInput = input.toLowerCase();

    // Lite keywords (simple definition queries)
    const liteKeywords = ['뭐야', '무엇', '정의', '의미'];

    // Check for Lite mode (simple definition)
    const isDefinitionQuery = liteKeywords.some(w => lowerInput.includes(w)) && input.length < 30;
    if (isDefinitionQuery) return 'lite';

    // Auto mode defaults to Standard for everything else
    // NEVER escalate to Hardcore automatically
    return 'standard';
}

/**
 * Fallback decision logic for Hardcore mode
 */
export function shouldFallback(review: ReviewResult, plan: PlanResult): boolean {
    // 1. Explicit fallback request
    if (review.needs_fallback === true) {
        return true;
    }

    // 2. Overall confidence threshold
    if (review.confidence_score < 0.65) {
        return true;
    }

    // 3. High-risk flags
    const highRiskFlags: ReviewResult['risk_flags'] = [
        'numeric_unverified',
        'time_sensitive_data',
        'logical_gap'
    ];

    if (review.risk_flags.some(flag => highRiskFlags.includes(flag))) {
        return true;
    }

    // 4. Plan-level time sensitivity + low factual reliability
    if (plan.risk_flags.includes('time_sensitive')) {
        if (review.factual_reliability < 0.7) {
            return true;
        }
    }

    return false;
}
