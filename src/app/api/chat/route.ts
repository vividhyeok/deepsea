import { NextRequest, NextResponse } from 'next/server';
import { deepSeekFetch, isTimeoutError, Message } from '@/lib/ai-providers';
import { detectMode, SYSTEM_PROMPTS, Mode } from '@/lib/modes';
import { verifyJWT } from '@/lib/jwt';

export const runtime = 'edge';

const MODE_OPTIONS: Record<Exclude<Mode, 'auto'>, { maxTokens: number; timeoutMs: number; temperature: number }> = {
  lite: { maxTokens: 520, timeoutMs: 8500, temperature: 0.2 },
  standard: { maxTokens: 620, timeoutMs: 9000, temperature: 0.25 },
  hardcore: { maxTokens: 700, timeoutMs: 9000, temperature: 0.2 },
};

function compactMessages(messages: Message[]) {
  const recent = messages.slice(-8);
  return recent.map((message) => ({
    role: message.role,
    content: String(message.content || '').slice(0, 2200),
  }));
}

function buildMessages(messages: Message[], mode: Exclude<Mode, 'auto'>): Message[] {
  return [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    ...messages.filter((message) => message.role !== 'system'),
  ];
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

    const stream = await deepSeekFetch(
      buildMessages(messages, mode),
      body?.model || 'deepseek-chat',
      MODE_OPTIONS[mode]
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    if (isTimeoutError(error) || (error instanceof Error && error.message === 'REQUEST_TIMEOUT')) {
      return NextResponse.json(
        { error: '응답 제한 시간(10초)에 도달했습니다. 입력을 더 짧게 나눠 다시 시도해 주세요.' },
        { status: 504 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
