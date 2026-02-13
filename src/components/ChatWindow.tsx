'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, LogOut, Plus, Send, Square } from 'lucide-react';
import MessageItem from './MessageItem';
import ModeSelector from './ModeSelector';
import { Message } from '@/lib/deepseek';
import { MODES, Mode } from '@/lib/modes';
import { cn } from '@/lib/utils';

const CLIENT_TIMEOUT_MS = 9500;

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const isInitialState = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleNewChat = () => {
    setMessages([]);
    setMode('auto');
    setInput('');
    stopGeneration();
  };

  const sendMessage = async (content: string, newMessages?: Message[]) => {
    if ((!content.trim() && !newMessages) || isLoading) return;

    const history = newMessages || [...messages, { role: 'user', content }];
    setMessages(history);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode, model: 'deepseek-chat' }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || response.statusText || 'Failed to generate response');
      }

      if (!response.body) {
        throw new Error('응답 스트림이 비어 있습니다.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          const data = JSON.parse(dataStr);
          const token = data.choices?.[0]?.delta?.content || '';
          accumulated += token;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '요청 시간이 제한을 초과했습니다. 문장을 짧게 나눠 다시 요청해 주세요.',
          },
        ]);
      } else {
        const message = error instanceof Error ? error.message : '응답 생성 중 오류가 발생했습니다.';
        setMessages((prev) => [...prev, { role: 'assistant', content: `오류: ${message}` }]);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleContinue = () => {
    sendMessage('앞 내용을 기준으로 핵심만 이어서 정리해줘.', [
      ...messages,
      { role: 'user', content: '앞 내용을 기준으로 핵심만 이어서 정리해줘.' },
    ]);
  };

  const handleRegenerate = () => {
    const latest = messages[messages.length - 1];
    if (latest?.role !== 'assistant') return;

    const history = messages.slice(0, -1);
    setMessages(history);
    sendMessage('', history);
  };

  const handleEditMessage = (index: number, newContent: string) => {
    const history = messages.slice(0, index);
    sendMessage(newContent, history);
  };

  return (
    <div className="flex h-screen flex-col bg-[#f7f7f8] text-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-[#f7f7f8]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={handleNewChat} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-white">
            <Image src="/logo.png" alt="로고" width={24} height={24} unoptimized />
            <span>사고 정리 도구</span>
          </button>

          <div className="flex items-center gap-2">
            {!isInitialState && (
              <button onClick={handleNewChat} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-gray-900" title="New chat">
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-red-500" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-5xl flex-1 px-4', isInitialState ? 'flex items-center justify-center' : 'overflow-y-auto pb-44 pt-6')}>
        {isInitialState ? (
          <section className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl shadow-xl ring-1 ring-gray-200 transition-transform hover:scale-105 duration-300">
                <Image src="/logo.png" alt="DeepSea Logo" fill className="object-contain" priority unoptimized />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">산만한 생각을 구조로 바꿉니다</h1>
                <p className="text-sm text-gray-500 md:text-lg">아이디어를 구조화·정제·검증하는 데 집중된 대화 도구입니다.</p>
              </div>
            </div>
            <InputBox
              textareaRef={textareaRef}
              input={input}
              onInput={setInput}
              onSend={() => sendMessage(input)}
              mode={mode}
              setMode={setMode}
              isLoading={isLoading}
              onStop={stopGeneration}
            />
          </section>
        ) : (
          <section className="mx-auto w-full max-w-3xl space-y-1">
            {messages.map((message, index) => (
              <MessageItem
                key={index}
                message={message}
                isStreaming={isLoading && index === messages.length - 1 && message.role === 'assistant'}
                onRegenerate={index === messages.length - 1 && message.role === 'assistant' ? handleRegenerate : undefined}
                onEdit={(content) => handleEditMessage(index, content)}
              />
            ))}
            <div ref={messagesEndRef} />
          </section>
        )}
      </main>

      {!isInitialState && (
        <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-[#f7f7f8]/90 px-4 py-4 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            <InputBox
              textareaRef={textareaRef}
              input={input}
              onInput={setInput}
              onSend={() => sendMessage(input)}
              mode={mode}
              setMode={setMode}
              isLoading={isLoading}
              onStop={stopGeneration}
            />
            {isLoading && (
              <button onClick={handleContinue} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:text-gray-900">
                <ArrowRight className="h-3 w-3" />
                Continue
              </button>
            )}
            <p className="text-center text-[11px] text-gray-500">중요 정보는 반드시 직접 확인하세요.</p>
          </div>
        </footer>
      )}
    </div>
  );
}

interface InputBoxProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  isLoading: boolean;
  onStop: () => void;
}

function InputBox({ textareaRef, input, onInput, onSend, mode, setMode, isLoading, onStop }: InputBoxProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(event) => onInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="정리하고 싶은 생각이나 초안을 입력하세요"
        rows={1}
        className="min-h-[56px] max-h-[180px] w-full resize-none rounded-xl border-0 px-3 py-3 text-[15px] outline-none placeholder:text-gray-400"
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <div className="flex items-center gap-2">
          <ModeSelector currentMode={mode} onChange={setMode} />
          <span className="text-xs text-gray-500">현재 모드: {MODES[mode]}</span>
        </div>

        {isLoading ? (
          <button onClick={onStop} className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            <Square className="mr-1 h-3.5 w-3.5" />
            Stop
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Send
          </button>
        )}
      </div>
    </div>
  );
}
