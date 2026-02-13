
'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/lib/deepseek';
import { Mode } from '@/lib/modes';
import { generateMarkdown, parseMarkdown } from '@/lib/storage';
import MessageItem from './MessageItem';
import ModeSelector from './ModeSelector';
import { Send, Download, Upload, LogOut, StopCircle, ArrowRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('auto');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const abortControllerRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initial state check: no messages
    const isInitialState = messages.length === 0;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!isInitialState) {
            scrollToBottom();
        }
    }, [messages, isInitialState]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/login');
    };

    const handleSave = () => {
        const markdown = generateMarkdown({ messages, mode, date: new Date().toISOString() });
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepsea-chat-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const data = parseMarkdown(text);
            setMessages(data.messages);
            setMode(data.mode);
        };
        reader.readAsText(file);
    };

    const sendMessage = async (content: string, newMessages?: Message[]) => {
        if ((!content.trim() && !newMessages)) return;

        setIsLoading(true);
        abortControllerRef.current = new AbortController();

        let currentMessages = newMessages || [...messages, { role: 'user', content }];
        setMessages(currentMessages);
        setInput('');

        // Reset height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages,
                    mode: mode,
                    model: 'deepseek-chat', // Default for now
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!res.ok) throw new Error(res.statusText);
            if (!res.body) throw new Error('No response body');

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || '';
                            if (content) {
                                assistantMessage += content;
                            }
                        } catch (e) { }
                    }
                }

                if (assistantMessage) {
                    setMessages(prev => {
                        const newMsg = [...prev];
                        newMsg[newMsg.length - 1] = { role: 'assistant', content: assistantMessage };
                        return newMsg;
                    });
                }
            }

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(error);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to generate response.' }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleContinue = () => {
        sendMessage("Continue request", [...messages, { role: 'user', content: 'Continue' }]);
    };

    const handleRegenerate = () => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
            const newHistory = messages.slice(0, -1);
            setMessages(newHistory);
            sendMessage('', newHistory);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setMode('auto');
        setInput('');
    };

    // Edit message and restart conversation from that point
    const handleEditMessage = (index: number, newContent: string) => {
        // Keep messages up to the index (exclusive), act as if this is a new message
        const newHistory = messages.slice(0, index);
        sendMessage(newContent, newHistory);
    };

    // Export single message
    const handleExportMessage = (message: Message) => {
        const markdown = `## ${message.role === 'user' ? 'User' : 'Assistant'}\n\n${message.content}`;
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepsea-message-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-screen bg-white text-gray-800 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Header (Minimal) */}
            <header className={cn(
                "fixed top-0 w-full z-10 transition-all duration-300",
                isInitialState ? "bg-transparent py-4" : "bg-white/80 backdrop-blur-md border-b border-gray-100 py-2.5"
            )}>
                <div className="max-w-[900px] mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {!isInitialState && (
                            <div
                                onClick={handleNewChat}
                                className="cursor-pointer flex items-center space-x-2 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
                            >
                                <div className="w-8 h-8 relative">
                                    <Image src="/logo.png" alt="Logo" fill className="object-contain" unoptimized />
                                </div>
                            </div>
                        )}
                        {/* If initial state, header logo is hidden (shown in center) */}
                        {isInitialState && <div className="w-8 h-8" />} {/* Spacer */}
                    </div>

                    <div className="flex items-center space-x-1">
                        {!isInitialState && (
                            <button onClick={handleNewChat} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-colors" title="New Chat">
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 scroll-smooth",
                isInitialState ? "overflow-hidden flex flex-col items-center justify-center" : "overflow-y-auto pt-16 pb-32"
            )}>
                {isInitialState ? (
                    // INITIAL STATE: Centered Logo + Input
                    <div className="w-full h-full flex flex-col items-center justify-center px-4 animate-in fade-in duration-500">
                        <div className="w-24 h-24 md:w-32 md:h-32 relative mb-6">
                            <Image src="/logo.png" alt="DeepSea" fill className="object-contain drop-shadow-sm" priority unoptimized />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 tracking-tight">DeepSea</h1>

                        {/* Central Input Box */}
                        <div className="w-full max-w-2xl">
                            <div className="relative bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all duration-300">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(input);
                                        }
                                    }}
                                    placeholder="무엇이든 물어보세요..."
                                    className="w-full bg-transparent px-5 py-4 text-gray-800 placeholder-gray-400 focus:outline-none resize-none min-h-[60px] max-h-[200px] text-[15px] rounded-2xl"
                                    rows={1}
                                />

                                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-50">
                                    <div className="flex items-center space-x-2">
                                        <ModeSelector currentMode={mode} onChange={setMode} />

                                        <div className="h-4 w-px bg-gray-200 mx-1" />

                                        <label className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Load Chat">
                                            <Upload className="w-4 h-4" />
                                            <input type="file" className="hidden" accept=".md" onChange={handleLoad} />
                                        </label>
                                    </div>

                                    <button
                                        onClick={() => sendMessage(input)}
                                        disabled={!input.trim()}
                                        className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-gray-500">
                                <button onClick={() => sendMessage("DeepSea의 주요 기능은 뭐야?")} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors">
                                    ✨ DeepSea 소개
                                </button>
                                <button onClick={() => sendMessage("복잡한 코드를 분석해줘")} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors">
                                    💻 코드 분석
                                </button>
                                <button onClick={() => sendMessage("주요 뉴스 요약해줘")} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors">
                                    📰 뉴스 요약
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // CHAT STATE: Standard Layout
                    <div className="max-w-[800px] mx-auto px-4 py-6">
                        {messages.map((msg, idx) => (
                            <MessageItem
                                key={idx}
                                message={msg}
                                isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
                                onRegenerate={idx === messages.length - 1 && msg.role === 'assistant' ? handleRegenerate : undefined}
                                onEdit={(newContent) => handleEditMessage(idx, newContent)}
                                onExport={() => handleExportMessage(msg)}
                            />
                        ))}

                        {isLoading && mode === 'hardcore' && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                            <div className="flex w-full mb-8 pl-14">
                                <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 px-4 py-2 rounded-lg flex items-center space-x-2 animate-pulse">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                                    <span>Thinking carefully...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </main>

            {/* Fixed Chat Input (Only visible in Chat State) */}
            {!isInitialState && (
                <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-100 pb-4 pt-4">
                    <div className="max-w-[800px] mx-auto px-4">
                        <div className="relative bg-white rounded-2xl shadow-sm border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all duration-300">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(input);
                                    }
                                }}
                                placeholder="Message DeepSea..."
                                className="w-full bg-transparent px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none resize-none max-h-[160px] min-h-[50px] rounded-2xl"
                                rows={1}
                            />

                            <div className="flex items-center justify-between px-2 py-1.5 ">
                                <div className="flex items-center space-x-1">
                                    <ModeSelector currentMode={mode} onChange={setMode} className="scale-90 origin-left" />

                                    {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                                        <button
                                            onClick={handleContinue}
                                            className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 border border-gray-200 transition-colors flex items-center space-x-1"
                                            title="Continue"
                                        >
                                            <ArrowRight className="w-3 h-3" />
                                            <span>Continue</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button onClick={handleSave} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" title="Save">
                                        <Download className="w-4 h-4" />
                                    </button>

                                    {isLoading ? (
                                        <button
                                            onClick={stopGeneration}
                                            className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all shadow-sm"
                                        >
                                            <StopCircle className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => sendMessage(input)}
                                            disabled={!input.trim()}
                                            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-center text-[10px] text-gray-400 mt-2">
                            AI generated content - verify important information.
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
