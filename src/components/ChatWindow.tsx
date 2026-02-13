
'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/lib/deepseek';
import { Mode } from '@/lib/modes';
import { generateMarkdown, parseMarkdown } from '@/lib/storage';
import MessageItem from './MessageItem';
import ModeSelector from './ModeSelector';
import { Send, Download, Upload, LogOut, StopCircle, RefreshCw, ArrowRight } from 'lucide-react';
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

        // Prepare messages
        let currentMessages = newMessages || [...messages, { role: 'user', content }];
        setMessages(currentMessages);
        setInput('');

        try {
            // Append length instruction if needed, or handle in API.
            // API doesn't know about outputLength state. 
            // We can append a system instruction or modify the last user message metadata?
            // Or just append it to the prompt.
            // "Output Length Control: Presets: short, normal, long"
            // Simplest is to append to the prompt internally or send as a parameter if API supported it.
            // Our API supports `mode`, `messages`. 
            // We can append `(Please keep the response ${outputLength})` to the last message?
            // Or send a temporary system message.

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

            // Create a placeholder for assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });

                // Parse SSE if needed. DeepSeek returns "data: JSON\n\n".
                // Use a simple buffer/parser approach.
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr.trim() === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || '';
                            if (content) {
                                assistantMessage += content;
                                setMessages(prev => {
                                    const newMsg = [...prev];
                                    newMsg[newMsg.length - 1] = { role: 'assistant', content: assistantMessage };
                                    return newMsg;
                                });
                            }
                        } catch (e) {/* ignore partial json */ }
                    }
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
        // Regenerate last assistant message
        // Remove last assistant message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
            const newHistory = messages.slice(0, -1);
            // We need to trigger send but without adding a new user message.
            // We just re-send the history.
            // wait, sendMessage assumes adding user content OR using newMessages.
            // If we pass newMessages, it sets state.
            // But we want to call API with the *last user message* being the trigger.
            setMessages(newHistory);
            // Trigger fetch with newHistory
            // We need to reuse the logic in sendMessage but specialized.
            // Actually, sendMessage can just take the history.
            // But sendMessage logic appends 'user' message if provided.
            // Let's refactor sendMessage to be more flexible or just copy logic.
            // Simpler: Just recursively call a refined request function.
            // I will just copy-paste logic for safety or make sendMessage accept "trigger immediately with these messages".

            // Hack: call sendMessage with empty string but `newMessages` set to history.
            // Ensure sendMessage doesn't append empty user msg if newMessages is passed.
            // My implementation: `if ((!content.trim() && !newMessages)) return;`
            // `let currentMessages = newMessages || ...`
            // So passing `newMessages` works.
            sendMessage('', newHistory);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <h1 className="font-bold text-lg tracking-tight">DeepSea</h1>
                </div>

                <div className="flex items-center space-x-4">
                    <ModeSelector currentMode={mode} onChange={setMode} />

                    <div className="h-6 w-px bg-gray-800 mx-2" />

                    <button onClick={handleSave} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" title="Save">
                        <Download className="w-5 h-5" />
                    </button>
                    <label className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer" title="Load">
                        <Upload className="w-5 h-5" />
                        <input type="file" className="hidden" accept=".md" onChange={handleLoad} />
                    </label>
                    <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-full text-red-500 hover:text-red-400 transition-colors" title="Logout">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                        <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800">
                            <span className="text-3xl">🐋</span>
                        </div>
                        <p>Welcome to DeepSea. Select a mode and start chatting.</p>
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
                        <div className="bg-gray-800/50 text-gray-400 rounded-lg p-3 text-sm animate-pulse border border-gray-700">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input */}
            <footer className="p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex items-end space-x-2">
                    {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                        <button
                            onClick={handleContinue}
                            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
                            title="Continue"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    )}

                    <div className="flex-1 bg-gray-950 border border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 shadow-lg relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(input);
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full bg-transparent p-4 text-gray-100 focus:outline-none resize-none max-h-48"
                            rows={1}
                            style={{ minHeight: '56px' }}
                        />
                    </div>

                    {isLoading ? (
                        <button
                            onClick={stopGeneration}
                            className="p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform transform active:scale-95"
                        >
                            <StopCircle className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim()}
                            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-transform transform active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                    AI can make mistakes. Check important info.
                </div>
            </footer>
        </div>
    );
}
