import { ChevronDown } from 'lucide-react';
import { Mode, MODES } from '@/lib/modes';
import { cn } from '@/lib/utils';

interface ModeSelectorProps {
  currentMode: Mode;
  onChange: (mode: Mode) => void;
  className?: string;
}

export default function ModeSelector({ currentMode, onChange, className }: ModeSelectorProps) {
  const modes: Mode[] = ['auto', 'lite', 'standard', 'hardcore'];

  return (
    <div className={cn('relative', className)}>
      <select
        value={currentMode}
        onChange={(event) => onChange(event.target.value as Mode)}
        className="appearance-none rounded-md border border-gray-200 bg-white py-1.5 pl-2 pr-7 text-xs font-medium uppercase tracking-wide text-gray-700 outline-none focus:border-gray-400"
      >
        {modes.map((mode) => (
          <option key={mode} value={mode}>
            {MODES[mode]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
