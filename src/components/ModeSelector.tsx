
import { Mode, MODES } from '@/lib/modes';
import { cn } from '@/lib/utils';
import { ChevronDown, Sparkles } from 'lucide-react';


interface ModeSelectorProps {
    currentMode: Mode;
    onChange: (mode: Mode) => void;
    className?: string;
}

export default function ModeSelector({ currentMode, onChange, className }: ModeSelectorProps) {
    const modes: Mode[] = ['auto', 'lite', 'standard', 'hardcore'];

    return (
        <div className={cn("relative group", className)}>
            <div className="flex items-center space-x-1.5 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors cursor-pointer group-focus-within:ring-2 group-focus-within:ring-blue-500/20">
                <Sparkles className={cn("w-3.5 h-3.5",
                    currentMode === 'hardcore' ? "text-purple-500" :
                        currentMode === 'auto' ? "text-blue-500" : "text-gray-400"
                )} />
                <select
                    value={currentMode}
                    onChange={(e) => onChange(e.target.value as Mode)}
                    className="appearance-none bg-transparent text-gray-700 font-medium text-xs focus:outline-none cursor-pointer pr-4 uppercase tracking-wide"
                >
                    {modes.map(m => (
                        <option key={m} value={m}>{MODES[m]}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <ChevronDown className="h-3 w-3" />
                </div>
            </div>

            {/* Tooltip for mode explanation could go here */}
        </div>
    );
}
