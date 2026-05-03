import { useSessionHistory, ActionType } from '@/contexts/SessionHistoryContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Undo2, 
  Plus, 
  Trash2, 
  Pencil, 
  CheckCircle, 
  Moon, 
  Sun,
  FolderPlus,
  FolderMinus,
  Settings,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const getActionIcon = (type: ActionType) => {
  switch (type) {
    case 'lesson_created':
      return Plus;
    case 'lesson_deleted':
      return Trash2;
    case 'lesson_edited':
      return Pencil;
    case 'lesson_reviewed':
      return CheckCircle;
    case 'lesson_snoozed':
    case 'category_snoozed':
      return Moon;
    case 'lesson_unsnoozed':
    case 'category_unsnoozed':
      return Sun;
    case 'category_created':
      return FolderPlus;
    case 'category_deleted':
      return FolderMinus;
    case 'category_renamed':
      return Pencil;
    case 'category_settings_changed':
      return Settings;
    default:
      return Clock;
  }
};

const getActionColor = (type: ActionType): string => {
  switch (type) {
    case 'lesson_created':
    case 'category_created':
      return 'text-success';
    case 'lesson_deleted':
    case 'category_deleted':
      return 'text-danger';
    case 'lesson_edited':
    case 'category_renamed':
    case 'category_settings_changed':
      return 'text-primary';
    case 'lesson_reviewed':
      return 'text-success';
    case 'lesson_snoozed':
    case 'category_snoozed':
      return 'text-muted-foreground';
    case 'lesson_unsnoozed':
    case 'category_unsnoozed':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
};

export const SessionHistory = () => {
  const { actions, undoAction, clearHistory } = useSessionHistory();
  const { restoreLesson, restoreCategory, deleteLesson, deleteCategory, renameCategory, updateCategoryData } = useLocalStorage();
  const { t } = useTranslation();

  const handleUndo = (actionId: string) => {
    const action = undoAction(actionId);
    if (!action) return;

    try {
      switch (action.type) {
        case 'lesson_deleted':
          if (action.undoData.previousLesson) {
            restoreLesson(action.undoData.previousLesson);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        case 'lesson_created':
          if (action.undoData.lessonId) {
            deleteLesson(action.undoData.lessonId);
            toast.success(t('sessionHistory.undone') || 'Undone');
          }
          break;
        case 'lesson_edited':
          if (action.undoData.previousLesson) {
            restoreLesson(action.undoData.previousLesson);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        case 'lesson_reviewed':
          if (action.undoData.previousLesson) {
            restoreLesson(action.undoData.previousLesson);
            toast.success(t('sessionHistory.reviewUndone') || 'Review undone');
          }
          break;
        case 'lesson_snoozed':
        case 'lesson_unsnoozed':
          if (action.undoData.previousLesson) {
            restoreLesson(action.undoData.previousLesson);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        case 'category_deleted':
          if (action.undoData.previousCategory) {
            restoreCategory(action.undoData.previousCategory);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        case 'category_created':
          if (action.undoData.categoryName) {
            deleteCategory(action.undoData.categoryName, false);
            toast.success(t('sessionHistory.undone') || 'Undone');
          }
          break;
        case 'category_renamed':
          if (action.undoData.previousCategoryName && action.undoData.categoryName) {
            renameCategory(action.undoData.categoryName, action.undoData.previousCategoryName);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        case 'category_settings_changed':
        case 'category_snoozed':
        case 'category_unsnoozed':
          if (action.undoData.previousCategory) {
            updateCategoryData(action.undoData.previousCategory);
            toast.success(t('sessionHistory.restored') || 'Restored');
          }
          break;
        default:
          toast.error(t('sessionHistory.cannotUndo') || 'Cannot undo this action');
      }
    } catch (error) {
      toast.error(t('sessionHistory.undoFailed') || 'Failed to undo');
    }
  };

  if (actions.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="text-sm text-muted-foreground">
          {t('sessionHistory.empty') || 'No actions in this session'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('sessionHistory.emptyDesc') || 'Actions you perform will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
          {actions.length} {actions.length === 1 ? 'action' : 'actions'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="text-[10px] sm:text-xs h-6 sm:h-7 px-2 text-muted-foreground hover:text-danger"
        >
          {t('sessionHistory.clearAll') || 'Clear All'}
        </Button>
      </div>
      
      <ScrollArea className="h-[250px] sm:h-[300px] -mx-1 px-1">
        <div className="space-y-1.5 sm:space-y-2">
          {actions.map((action) => {
            const Icon = getActionIcon(action.type);
            const colorClass = getActionColor(action.type);
            
            return (
              <div 
                key={action.id}
                className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={`p-1 sm:p-1.5 rounded-full bg-muted shrink-0 ${colorClass}`}>
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {action.description}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                    {format(action.timestamp, 'HH:mm:ss')}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUndo(action.id)}
                  className="h-7 sm:h-8 px-1.5 sm:px-2 text-primary hover:bg-primary/10 shrink-0"
                  title={t('actions.undo') || 'Undo'}
                >
                  <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs ml-1 hidden sm:inline">{t('actions.undo') || 'Undo'}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
