
import { Message } from './deepseek';

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

    hardcore_step1: `Create a concise structural outline:
- What is the core problem?
- What dimensions must be analyzed?
- What structure will the answer follow?

Maximum 6 lines.
No detailed reasoning.`,

    hardcore_step2: `You are DeepSea. Answer the user's request using the following structural plan.

Plan:
{PLAN}

Structure:
1. 핵심 개념 정리 (Core concept clarification)
2. 구체적 분석 (Specific analysis)
3. 실전 적용 전략 (Practical application strategy)
4. 한계 및 주의점 (Limitations and cautions)

Rules:
- Avoid strong certainty expressions
- Mark uncertain data as "확인 필요"
- Prioritize factual correctness over the plan

${BASE_RULES}`,

    hardcore_step3_verify: `Review the following answer for quality issues:

Answer:
{ANSWER}

Check only:
- Logical leaps
- Overgeneralization
- Uncertain numbers/facts
- Ambiguous expressions

If issues found, provide a corrected version. Otherwise, return "PASS".`,
};

export function detectMode(input: string, currentMode: Mode): Mode {
    if (currentMode !== 'auto') return currentMode;

    const lowerInput = input.toLowerCase();

    // Hardcore keywords (cognitive difficulty indicators)
    const hardcoreKeywords = [
        '왜', '원인', '구조', '병목', '전략', '단계적으로',
        '근거', '비교', '분석', '검증', '설계', '최적화',
        '구체적으로', '체계적으로', '정리해줘'
    ];

    // Lite keywords (simple definition queries)
    const liteKeywords = ['뭐야', '무엇', '정의', '의미'];

    // Check for Lite mode (simple definition)
    const isDefinitionQuery = liteKeywords.some(w => lowerInput.includes(w)) && input.length < 30;
    if (isDefinitionQuery) return 'lite';

    // Check for Hardcore mode
    const hasHardcoreKeyword = hardcoreKeywords.some(w => lowerInput.includes(w));
    const isLongQuery = input.length >= 20;
    const requiresAnalysis = /코드|수학|아키텍처|정책/.test(lowerInput);

    // Escalate to Hardcore if:
    // 1. Has hardcore keyword + long query
    // 2. Requires technical analysis
    if ((hasHardcoreKeyword && isLongQuery) || requiresAnalysis) {
        return 'hardcore';
    }

    // Default to Standard for comparison/explanation queries
    return 'standard';
}
