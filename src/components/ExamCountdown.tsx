import { Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamCountdownProps {
  daysUntilExam: number | null;
  showWarning?: boolean;
  compact?: boolean;
}

export const ExamCountdown = ({ daysUntilExam, showWarning, compact }: ExamCountdownProps) => {
  if (daysUntilExam === null) return null;

  const isOverdue = daysUntilExam < 0;
  const isUrgent = daysUntilExam >= 0 && daysUntilExam <= 7;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg',
      compact ? 'px-2 py-1' : 'px-3 py-2',
      isOverdue ? 'bg-danger/10 text-danger' :
      isUrgent ? 'bg-warning/10 text-warning' :
      'bg-primary/10 text-primary'
    )}>
      <Calendar className={cn(compact ? 'w-3 h-3' : 'w-4 h-4')} />
      <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>
        {isOverdue 
          ? `${Math.abs(daysUntilExam)} days ago`
          : daysUntilExam === 0 
            ? 'Today!' 
            : `${daysUntilExam} days`
        }
      </span>
      {showWarning && !isOverdue && (
        <AlertTriangle className={cn(compact ? 'w-3 h-3' : 'w-4 h-4', 'text-warning')} />
      )}
    </div>
  );
};
