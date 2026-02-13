
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/deepseek';
import { cn } from '@/lib/utils';
import { Copy, RefreshCw, Pencil } from 'lucide-react';
import { useState } from 'react';

interface MessageItemProps {
    message: Message;
    isStreaming?: boolean;
    onRegenerate?: () => void;
    onEdit?: (newContent: string) => void;
}

export default function MessageItem({ message, isStreaming, onRegenerate, onEdit }: MessageItemProps) {
    const isUser = message.role === 'user';
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
    };

    const handleSaveEdit = () => {
        if (onEdit) {
            onEdit(editContent);
            setIsEditing(false);
        }
    };

    return (
        <div className={cn(
            "flex w-full mb-6",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[85%] md:max-w-[75%] rounded-lg p-4 relative group",
                isUser ? "bg-blue-600/20 text-blue-50 border border-blue-500/30" : "bg-gray-800/50 text-gray-100 border border-gray-700"
            )}>
                {/* Role label */}
                <div className="text-xs font-mono text-gray-400 mb-2 flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span>{isUser ? 'YOU' : 'DEEPSEA'}</span>
                    <div className="flex space-x-2">
                        {!isUser && !isStreaming && (
                            <button onClick={handleCopy} className="hover:text-white" title="Copy">
                                <Copy className="w-3 h-3" />
                            </button>
                        )}
                        {!isUser && !isStreaming && onRegenerate && (
                            <button onClick={onRegenerate} className="hover:text-white" title="Regenerate">
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        )}
                        {isUser && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="hover:text-white" title="Edit">
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {isEditing ? (
                    <div className="flex flex-col space-y-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-gray-900/50 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                            rows={3}
                        />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setIsEditing(false)} className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
                            <button onClick={handleSaveEdit} className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-500">Save</button>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                        {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />}
                    </div>
                )}
            </div>
        </div>
    );
}
