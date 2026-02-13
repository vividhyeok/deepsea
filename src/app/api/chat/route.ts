import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, isTimeoutError, Message } from '@/lib/ai-providers';
import { detectMode, getTaskHint, SYSTEM_PROMPTS, Mode } from '@/lib/modes';
import { verifyJWT } from '@/lib/jwt';

export const runtime = 'edge';

const MODE_OPTIONS: Record<Exclude<Mode, 'auto'>, { maxTokens: number; timeoutMs: number; temperature: number }> = {
  lite: { maxTokens: 380, timeoutMs: 17000, temperature: 0.2 },
  standard: { maxTokens: 680, timeoutMs: 20000, temperature: 0.3 },
  hardcore: { maxTokens: 860, timeoutMs: 22000, temperature: 0.25 },
};

function compactMessages(messages: Message[]) {
  const recent = messages.slice(-8);
  return recent.map((message) => ({
    role: message.role,
    content: String(message.content || '').slice(0, 2600),
  }));
}

function buildMessages(messages: Message[], mode: Exclude<Mode, 'auto'>): Message[] {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';

  const system = [
    SYSTEM_PROMPTS[mode],
    getTaskHint(latestUser),
    'Always provide a concise direct answer first, then structured details if needed.',
  ].join('\n\n');

  return [{ role: 'system', content: system }, ...messages.filter((message) => message.role !== 'system')];
}

async function streamWithMode(messages: Message[], model: string, mode: Exclude<Mode, 'auto'>) {
  return deepSeekFetch(buildMessages(messages, mode), model, MODE_OPTIONS[mode]);
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token || !(await verifyJWT(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

    if (rawMessages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    const messages = compactMessages(rawMessages);
    const lastMessage = messages[messages.length - 1];

    const requestedMode: Mode = body?.mode || 'auto';
    const mode: Exclude<Mode, 'auto'> = requestedMode === 'auto' ? detectMode(lastMessage?.content ?? '', 'auto') : requestedMode;

    const currentModel = body?.model || 'deepseek-chat';

    try {
      const stream = await streamWithMode(messages, currentModel, mode);

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      if (!isTimeoutError(error)) throw error;

      const fallbackMode: Exclude<Mode, 'auto'> = mode === 'hardcore' ? 'standard' : 'lite';
      const fallbackMessages = [
        ...messages,
        {
          role: 'user',
          content: '시간 제한이 있는 환경입니다. 위 요청에 대해 핵심 결론과 실행 단계만 짧고 정확하게 제시해줘.',
        },
      ] satisfies Message[];

      const fallbackStream = await streamWithMode(fallbackMessages, currentModel, fallbackMode);

      return new Response(fallbackStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Mode-Fallback': fallbackMode,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';

    return NextResponse.json(
      {
        error: message === 'REQUEST_TIMEOUT'
          ? '응답 생성 시간이 초과되었습니다. 요청을 더 짧게 나누어 다시 시도해 주세요.'
          : message,
      },
      { status: message === 'REQUEST_TIMEOUT' ? 504 : 500 }
    );
  }
}
