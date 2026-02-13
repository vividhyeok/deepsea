
'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/lib/deepseek';
import { Mode } from '@/lib/modes';
import { generateMarkdown, parseMarkdown } from '@/lib/storage';
import MessageItem from './MessageItem';
import ModeSelector from './ModeSelector';
import { Send, Download, Upload, LogOut, StopCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('standard');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages,
                    mode: mode,
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

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
            {/* Minimal Header */}
            <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h1 className="font-semibold text-sm tracking-tight">DeepSea</h1>
                    </div>

                    <div className="flex items-center space-x-3">
                        <ModeSelector currentMode={mode} onChange={setMode} />
                        <div className="h-4 w-px bg-gray-700" />
                        <button onClick={handleSave} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors" title="Save">
                            <Download className="w-4 h-4" />
                        </button>
                        <label className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer" title="Load">
                            <Upload className="w-4 h-4" />
                            <input type="file" className="hidden" accept=".md" onChange={handleLoad} />
                        </label>
                        <button onClick={handleLogout} className="p-1.5 hover:bg-gray-800 rounded text-red-400 hover:text-red-300 transition-colors" title="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Messages - Centered */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-20">
                            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700">
                                <span className="text-3xl">🐋</span>
                            </div>
                            <p className="text-sm">Welcome to DeepSea. Select a mode and start chatting.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <MessageItem
                            key={idx}
                            message={msg}
                            isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
                            onRegenerate={idx === messages.length - 1 && msg.role === 'assistant' ? handleRegenerate : undefined}
                        />
                    ))}

                    {isLoading && mode === 'hardcore' && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <div className="flex w-full mb-6 justify-start">
                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-gray-400 rounded-lg px-4 py-2 text-sm animate-pulse border border-blue-500/20">
                                Thinking...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input - Fixed Bottom, Centered */}
            <footer className="border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-end space-x-2 mb-2">
                        {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                            <button
                                onClick={handleContinue}
                                className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
                                title="Continue"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}

                        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(input);
                                    }
                                }}
                                placeholder="Message DeepSea..."
                                className="w-full bg-transparent px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-48"
                                rows={1}
                            />
                        </div>

                        {isLoading ? (
                            <button
                                onClick={stopGeneration}
                                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all"
                            >
                                <StopCircle className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim()}
                                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="text-center text-xs text-gray-500">
                        AI can make mistakes. Check important info.
                    </div>
                </div>
            </footer>
        </div>
    );
}
