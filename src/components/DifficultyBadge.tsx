import { cn } from '@/lib/utils';
import { Difficulty } from '@/types/lesson';
import { useTranslation } from '@/hooks/useTranslation';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
}

export const DifficultyBadge = ({ difficulty, className }: DifficultyBadgeProps) => {
  const { t } = useTranslation();
  
  const config = {
    Easy: { filled: 1, colorClass: 'bg-success' },
    Medium: { filled: 2, colorClass: 'bg-warning' },
    Hard: { filled: 3, colorClass: 'bg-danger' },
  };

  const { filled, colorClass } = config[difficulty];
  const translatedDifficulty = t(`difficulties.${difficulty}`);

  return (
    <div 
      className={cn('flex items-center gap-0.5', className)} 
      title={translatedDifficulty}
      aria-label={`${t('lesson.difficulty')}: ${translatedDifficulty}`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-colors',
            i <= filled ? colorClass : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
};
