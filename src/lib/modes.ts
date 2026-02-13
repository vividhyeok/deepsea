
import { Message } from './deepseek';

export type Mode = 'auto' | 'lite' | 'standard' | 'hardcore';

export const MODES: Record<Mode, string> = {
    auto: 'Auto',
    lite: 'Lite',
    standard: 'Standard',
    hardcore: 'Hardcore',
};

export const SYSTEM_PROMPTS = {
    standard: `You are DeepSea, a helpful and accurate AI assistant.
Rules:
- Provide clear, concise, and accurate answers.
- Admit when you don't know something; do not hallucinate.
- If the user asks for code, provide production-ready, clean code.`,

    hardcore_step1: `You are a strategic planner. Analyze the user's request.
Output a concise "Structure/Strategy Sketch" for how to best answer this request.
Do not output the final answer yet. Just the plan/structure.`,

    hardcore_step2: `You are DeepSea. Answer the user's request using the following strategic plan as context.
Existing Plan:
{PLAN}

Follow the plan to provide a high-quality, comprehensive answer.`,
};

export function detectMode(input: string, currentMode: Mode): Mode {
    if (currentMode !== 'auto') return currentMode;

    // Auto-escalation logic
    const hardcoreKeywords = ['complex', 'architecture', 'design pattern', 'hardcore', 'deep dive', 'analysis', 'plan'];
    if (hardcoreKeywords.some(w => input.toLowerCase().includes(w))) {
        return 'hardcore';
    }

    return 'standard';
}
