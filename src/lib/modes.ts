export type Mode = 'auto' | 'lite' | 'standard' | 'hardcore';

export const MODES: Record<Mode, string> = {
  auto: 'Auto',
  lite: 'Lite',
  standard: 'Standard',
  hardcore: 'Hardcore',
};

export const BASE_RULES = `
You are a high-quality general AI assistant optimized for practical output.

Global rules:
1) Never fabricate facts, metrics, versions, sources, dates, or citations.
2) If uncertain, explicitly mark as "확인 필요".
3) Give direct answers first, then details.
4) Reduce verbosity unless the user asks for depth.
5) For technical tasks, include edge cases and failure handling.
`;

export const SYSTEM_PROMPTS: Record<Exclude<Mode, 'auto'>, string> = {
  lite: `
${BASE_RULES}
Mode: LITE

Output contract:
- 3~8 lines by default.
- Bullet-first style.
- Include only immediately useful information.
`,

  standard: `
${BASE_RULES}
Mode: STANDARD

Output contract (when relevant):
1) 핵심 요약
2) 실행 단계
3) 주의사항

Quality checks:
- Remove redundant statements.
- When ambiguity exists, present best assumption + confirm item.
`,

  hardcore: `
${BASE_RULES}
Mode: HARDCORE

Output contract:
1) 핵심 결론
2) 설계/전략
3) 리스크/병목
4) 대안 비교
5) 확인 필요

Quality checks:
- Include trade-offs and rollback path.
- Keep depth high but avoid filler.
`,
};

export function detectMode(input: string, currentMode: Mode): Mode {
  if (currentMode !== 'auto') return currentMode;

  const normalized = input.toLowerCase();
  const length = normalized.length;

  const hardcoreSignals = [
    'architecture', 'trade-off', 'bottleneck', 'scalability',
    '설계', '아키텍처', '리스크', '비교', '분석', '전략', '최적화', '장단점',
  ];

  const liteSignals = ['요약', '한줄', '짧게', 'quick', '간단히'];

  if (liteSignals.some((keyword) => normalized.includes(keyword))) return 'lite';
  if (length < 70) return 'lite';
  if (length > 240 || hardcoreSignals.some((keyword) => normalized.includes(keyword))) return 'hardcore';

  return 'standard';
}

export function getTaskHint(input: string): string {
  const value = input.toLowerCase();

  if (/코드|버그|에러|debug|stack|typescript|next\.js|react|api/.test(value)) {
    return `Task type: engineering. Provide root-cause-first guidance, concrete steps, and test checklist.`;
  }

  if (/기획|전략|roadmap|우선순위|비즈니스|시장/.test(value)) {
    return `Task type: planning. Provide clear options, trade-offs, and recommended next action.`;
  }

  if (/글|문장|카피|메일|요청서|제안서|rewrite|tone/.test(value)) {
    return `Task type: writing. Produce polished output first, then optional alternatives.`;
  }

  return `Task type: general. Prioritize clarity, correctness, and immediate usefulness.`;
}
