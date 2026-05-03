import { Check } from 'lucide-react';
import { ColorTheme } from '@/types/lesson';
import { cn } from '@/lib/utils';

interface ThemePickerProps {
  currentTheme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
}

const themes: { id: ColorTheme; name: string; gradient: string }[] = [
  { id: 'zinc', name: 'Default', gradient: 'from-zinc-400 via-zinc-600 to-zinc-800' },
  { id: 'glacier', name: 'Glacier', gradient: 'from-sky-300 via-cyan-500 to-cyan-700' },
  { id: 'harvest', name: 'Harvest', gradient: 'from-amber-300 via-amber-500 to-orange-600' },
  { id: 'lavender', name: 'Lavender', gradient: 'from-violet-300 via-purple-500 to-purple-700' },
  { id: 'brutalist', name: 'Brutalist', gradient: 'from-neutral-100 via-neutral-500 to-neutral-900' },
  { id: 'obsidian', name: 'Obsidian', gradient: 'from-purple-400 via-violet-600 to-purple-900' },
  { id: 'orchid', name: 'Orchid', gradient: 'from-pink-300 via-pink-500 to-rose-600' },
  { id: 'solar', name: 'Solar', gradient: 'from-yellow-300 via-yellow-500 to-amber-600' },
  { id: 'tide', name: 'Tide', gradient: 'from-cyan-300 via-teal-500 to-teal-700' },
  { id: 'verdant', name: 'Verdant', gradient: 'from-emerald-300 via-green-500 to-emerald-700' },
];

export const ThemePicker = ({ currentTheme, onThemeChange }: ThemePickerProps) => {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => onThemeChange(theme.id)}
          className="flex flex-col items-center gap-1.5"
        >
          <div
            className={cn(
              'w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br shadow-md transition-all duration-200 relative',
              theme.gradient,
              currentTheme === theme.id
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                : 'hover:scale-105'
            )}
          >
            {currentTheme === theme.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-5 h-5 text-white drop-shadow-md" />
              </div>
            )}
          </div>
          <span className={cn(
            'text-[10px] sm:text-xs font-medium text-center leading-tight',
            currentTheme === theme.id ? 'text-primary' : 'text-muted-foreground'
          )}>
            {theme.name}
          </span>
        </button>
      ))}
    </div>
  );
};
