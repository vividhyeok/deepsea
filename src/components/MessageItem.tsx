
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/deepseek';
import { cn } from '@/lib/utils';
import { Copy, RefreshCw, Pencil, Check, Download } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface MessageItemProps {
    message: Message;
    isStreaming?: boolean;
    onRegenerate?: () => void;
    onEdit?: (newContent: string) => void;
    onExport?: () => void;
}

export default function MessageItem({ message, isStreaming, onRegenerate, onEdit, onExport }: MessageItemProps) {
    const isUser = message.role === 'user';
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveEdit = () => {
        if (onEdit) {
            onEdit(editContent);
            setIsEditing(false);
        }
    };

    return (
        <div className={cn(
            "flex w-full mb-8",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "flex max-w-[90%] md:max-w-[85%] lg:max-w-[80%]",
                isUser ? "flex-row-reverse" : "flex-row"
            )}>
                {/* Avatar */}
                <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-gray-100",
                    isUser ? "ml-4 bg-gray-200" : "mr-4 bg-white"
                )}>
                    {isUser ? (
                        <div className="text-gray-500 text-xs font-bold">YOU</div>
                    ) : (
                        <Image src="/logo.png" alt="DeepSea" width={32} height={32} className="object-cover" unoptimized />
                    )}
                </div>

                {/* Content Bubble */}
                <div className={cn(
                    "relative group px-5 py-3.5 rounded-2xl text-[15px] leading-7 shadow-sm",
                    isUser
                        ? "bg-[#f3f4f6] text-gray-800 rounded-tr-sm"
                        : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm ring-1 ring-gray-900/5"
                )}>
                    {/* Role label & Actions (Assistant only) */}
                    {!isUser && !isEditing && (
                        <div className="absolute -bottom-6 left-0 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Copy">
                                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {!isStreaming && onRegenerate && (
                                <button onClick={onRegenerate} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Regenerate">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {!isStreaming && onExport && (
                                <button onClick={onExport} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Export Message">
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* User Actions */}
                    {isUser && !isEditing && (
                        <div className="absolute -bottom-6 right-0 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setIsEditing(true)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    {isEditing ? (
                        <div className="flex flex-col space-y-2 min-w-[300px]">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                rows={4}
                            />
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => setIsEditing(false)} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 font-medium">Cancel</button>
                                <button onClick={handleSaveEdit} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-slate max-w-none break-words dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                            {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse align-middle" />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
