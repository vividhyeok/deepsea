
import { Mode, MODES } from '@/lib/modes';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';


interface ModeSelectorProps {
    currentMode: Mode;
    onChange: (mode: Mode) => void;
    className?: string;
}

export default function ModeSelector({ currentMode, onChange, className }: ModeSelectorProps) {
    const modes: Mode[] = ['auto', 'lite', 'standard', 'hardcore'];

    return (
        <div className={cn("relative group", className)}>
            <select
                value={currentMode}
                onChange={(e) => onChange(e.target.value as Mode)}
                className="appearance-none bg-gray-900 border border-gray-700 text-gray-200 py-1 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-gray-800 focus:border-gray-500 text-sm"
            >
                {modes.map(m => (
                    <option key={m} value={m}>{MODES[m]}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <ChevronDown className="h-4 w-4" />
            </div>
        </div>
    );
}
