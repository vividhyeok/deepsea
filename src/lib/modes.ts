export type Mode = 'auto' | 'lite' | 'standard' | 'hardcore';

export const MODES: Record<Mode, string> = {
  auto: 'Auto',
  lite: 'Lite',
  standard: 'Standard',
  hardcore: 'Hardcore',
};

export const BASE_RULES = `
You are a structured-thinking assistant focused on refining messy ideas.

Rules:
1) Do not fabricate facts, numbers, dates, or sources.
2) Mark uncertainty as "확인 필요".
3) Remove repetition and keep output compact.
4) Prefer clear Markdown sections.
5) Prioritize structure and practical next action.
`;

export const SYSTEM_PROMPTS: Record<Exclude<Mode, 'auto'>, string> = {
  lite: `
${BASE_RULES}
Mode: LITE

Goal:
- Fast summary and cleanup.

Format:
- 핵심 요약
- 정리된 포인트
`,

  standard: `
${BASE_RULES}
Mode: STANDARD

Goal:
- Structure and refine scattered thoughts.

Format:
1) 핵심 요약
2) 구조화된 정리
3) 실행 제안
4) 확인 필요
`,

  hardcore: `
${BASE_RULES}
Mode: HARDCORE (Designer Mode)

Must include all 4:
1) Core Intent 추출
2) 계층적 구조 재정렬
3) 논리적 약점/가정 탐지
4) 정제된 최종 버전

Also:
- Explicitly point out assumptions.
- Keep density high, avoid fluff.
`,
};

export function detectMode(input: string, currentMode: Mode): Mode {
  if (currentMode !== 'auto') return currentMode;

  const text = input.toLowerCase();
  const length = text.length;
  const isComplex =
    text.includes('설계') ||
    text.includes('구조') ||
    text.includes('분석') ||
    text.includes('리스크') ||
    text.includes('가정') ||
    text.includes('전략');

  if (length < 80 && !isComplex) return 'lite';
  if (length > 220 || isComplex) return 'hardcore';

  return 'standard';
}
