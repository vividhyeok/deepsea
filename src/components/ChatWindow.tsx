'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Download, LogOut, Plus, Send, Square, Upload } from 'lucide-react';
import MessageItem from './MessageItem';
import ModeSelector from './ModeSelector';
import { Message } from '@/lib/deepseek';
import { Mode } from '@/lib/modes';
import { generateMarkdown, parseMarkdown } from '@/lib/storage';
import { cn } from '@/lib/utils';

const CLIENT_TIMEOUT_MS = 26000;

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

  const handleSave = () => {
    const markdown = generateMarkdown({ messages, mode, date: new Date().toISOString() });
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `대화기록-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result as string;
      const data = parseMarkdown(text);
      setMessages(data.messages);
      setMode(data.mode);
    };

    reader.readAsText(file);
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
            content:
              '요청 시간이 길어 중단되었습니다. 요청을 더 작게 나누거나 모드를 Lite/Standard로 바꿔 다시 시도해 주세요.',
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

  const handleContinue = () => sendMessage('계속 이어서 작성해줘.', [...messages, { role: 'user', content: '계속 이어서 작성해줘.' }]);

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

  const handleExportMessage = (message: Message) => {
    const markdown = `## ${message.role === 'user' ? 'User' : 'Assistant'}\n\n${message.content}`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `메시지-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-[#f7f7f8] text-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-[#f7f7f8]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={handleNewChat} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-white">
            <Image src="/logo.png" alt="로고" width={24} height={24} unoptimized />
            <span>대화 도우미</span>
          </button>

          <div className="flex items-center gap-2">
            {!isInitialState && (
              <>
                <button onClick={handleSave} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-gray-900" title="Save chat">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={handleNewChat} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-gray-900" title="New chat">
                  <Plus className="h-4 w-4" />
                </button>
              </>
            )}
            <button onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-red-500" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-5xl flex-1 px-4', isInitialState ? 'flex items-center justify-center' : 'overflow-y-auto pb-44 pt-6')}>
        {isInitialState ? (
          <section className="w-full max-w-3xl space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">가볍고 빠른 AI 도우미</h1>
              <p className="text-sm text-gray-500 md:text-base">필요한 답을 빠르게 얻을 수 있도록 단순한 대화 흐름으로 구성했습니다.</p>
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
              onLoad={handleLoad}
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
                onExport={() => handleExportMessage(message)}
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
              onLoad={handleLoad}
            />
            {isLoading && (
              <button onClick={handleContinue} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:text-gray-900">
                <ArrowRight className="h-3 w-3" />
                Continue
              </button>
            )}
            <p className="text-center text-[11px] text-gray-500">AI generated content — verify important information.</p>
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
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function InputBox({ textareaRef, input, onInput, onSend, mode, setMode, isLoading, onStop, onLoad }: InputBoxProps) {
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
        placeholder="무엇이든 물어보세요"
        rows={1}
        className="min-h-[56px] max-h-[180px] w-full resize-none rounded-xl border-0 px-3 py-3 text-[15px] outline-none placeholder:text-gray-400"
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <div className="flex items-center gap-2">
          <ModeSelector currentMode={mode} onChange={setMode} />
          <label className="cursor-pointer rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Load chat">
            <Upload className="h-4 w-4" />
            <input type="file" accept=".md" className="hidden" onChange={onLoad} />
          </label>
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
