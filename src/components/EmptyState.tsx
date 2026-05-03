import { BookOpen, CheckCircle2, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

interface EmptyStateProps {
  type: 'no-lessons' | 'all-done';
  onAddLesson?: () => void;
}

export const EmptyState = ({ type, onAddLesson }: EmptyStateProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (type === 'all-done') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
          {t('empty.allDone')}
        </h3>
        <p className="text-muted-foreground max-w-xs mb-4">
          {t('empty.allDoneDesc')}
        </p>
        <Button 
          variant="outline" 
          onClick={() => navigate('/library')}
          className="gap-2"
        >
          <Library className="w-4 h-4" />
          {t('actions.viewLibrary')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <BookOpen className="w-10 h-10 text-primary" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
        {t('empty.noLessons')}
      </h3>
      <p className="text-muted-foreground max-w-xs mb-4">
        {t('empty.noLessonsDesc')}
      </p>
      {onAddLesson && (
        <Button onClick={onAddLesson} className="gap-2">
          <BookOpen className="w-4 h-4" />
          {t('empty.addFirstLesson')}
        </Button>
      )}
    </div>
  );
};
