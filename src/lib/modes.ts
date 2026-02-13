
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

    // Single-call Hardcore prompt for GPT-4
    hardcore_gpt: `You are DeepSea in Hardcore mode, powered by GPT-4.

Your task is to provide a deeply structured, well-reasoned answer.

Internal Process (do not show to user):
1. Analyze the core problem
2. Plan your response structure
3. Self-verify for logical consistency

Output Structure (show to user):
1. 핵심 개념 정리 (Core concept clarification)
2. 구체적 분석 (Specific analysis with reasoning)
3. 실전 적용 전략 (Practical application strategy)
4. 한계 및 주의점 (Limitations and cautions)

Critical Rules:
- Prioritize correctness over speed
- Mark uncertain data as "확인 필요"
- Avoid speculation beyond 2-3 lines
- Use structured markdown (headings, lists, code blocks)
- If the question is ambiguous, clarify assumptions first

${BASE_RULES}`,
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
