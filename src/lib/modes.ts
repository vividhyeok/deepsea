
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
- Keep explanation concise
- Avoid deep breakdown or extended reasoning
- Minimize speculation
- If uncertain, say "확인되지 않음" and stop

${BASE_RULES}`,

    standard: `You are DeepSea in Standard mode.

Structure guideline:
- Provide verified information
- If estimation is necessary, clearly label it as "추정"
- If verification is required, add a short "주의사항"
- Only include sections when relevant

${BASE_RULES}`,

    hardcore_step1: `Generate a short 3-bullet outline of the answer structure.
No reasoning details.
Structure only.`,

    hardcore_step2: `You are DeepSea. Answer the user's request using the following outline as guidance.

Outline:
{PLAN}

Follow the outline but prioritize factual correctness over the outline.
Provide comprehensive, well-structured answer.

${BASE_RULES}`,
};

export function detectMode(input: string, currentMode: Mode): Mode {
    if (currentMode !== 'auto') return currentMode;

    // Condition 1: Keywords
    const hardcoreKeywords = ['근거', '비교', '검증', '최신', '정확히', '출처', '리서치'];
    const hasKeyword = hardcoreKeywords.some(w => input.toLowerCase().includes(w));

    // Condition 2: Length
    const isLong = input.length > 200;

    // Condition 3: Analytical intent (multiple questions or complex structure)
    const questionCount = (input.match(/\?/g) || []).length;
    const hasAnalyticalIntent = questionCount >= 2 || /어떻게|왜|근거|이유/.test(input);

    // Escalate if 2+ conditions met
    const conditions = [hasKeyword, isLong, hasAnalyticalIntent].filter(Boolean).length;

    return conditions >= 2 ? 'hardcore' : 'standard';
}
