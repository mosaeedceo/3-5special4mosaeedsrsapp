import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Lesson, CategoryData } from '@/types/lesson';

export type ActionType = 
  | 'lesson_created'
  | 'lesson_deleted'
  | 'lesson_edited'
  | 'lesson_reviewed'
  | 'lesson_snoozed'
  | 'lesson_unsnoozed'
  | 'category_created'
  | 'category_deleted'
  | 'category_renamed'
  | 'category_settings_changed'
  | 'category_snoozed'
  | 'category_unsnoozed';

export interface HistoryAction {
  id: string;
  type: ActionType;
  description: string;
  timestamp: Date;
  undoData: {
    lessonId?: string;
    categoryName?: string;
    previousLesson?: Lesson;
    previousCategory?: CategoryData;
    previousCategoryName?: string;
    newLesson?: Lesson;
    newCategory?: CategoryData;
  };
}

interface SessionHistoryContextType {
  actions: HistoryAction[];
  recordAction: (type: ActionType, description: string, undoData: HistoryAction['undoData']) => string;
  undoAction: (actionId: string) => HistoryAction | undefined;
  removeAction: (actionId: string) => void;
  clearHistory: () => void;
}

const SessionHistoryContext = createContext<SessionHistoryContextType | null>(null);

export const useSessionHistory = () => {
  const context = useContext(SessionHistoryContext);
  if (!context) {
    throw new Error('useSessionHistory must be used within SessionHistoryProvider');
  }
  return context;
};

interface SessionHistoryProviderProps {
  children: ReactNode;
}

export const SessionHistoryProvider = ({ children }: SessionHistoryProviderProps) => {
  const [actions, setActions] = useState<HistoryAction[]>([]);

  const recordAction = useCallback((
    type: ActionType,
    description: string,
    undoData: HistoryAction['undoData']
  ): string => {
    const id = crypto.randomUUID();
    const action: HistoryAction = {
      id,
      type,
      description,
      timestamp: new Date(),
      undoData,
    };
    setActions(prev => [action, ...prev]);
    return id;
  }, []);

  const undoAction = useCallback((actionId: string): HistoryAction | undefined => {
    const action = actions.find(a => a.id === actionId);
    if (action) {
      setActions(prev => prev.filter(a => a.id !== actionId));
    }
    return action;
  }, [actions]);

  const removeAction = useCallback((actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const clearHistory = useCallback(() => {
    setActions([]);
  }, []);

  return (
    <SessionHistoryContext.Provider value={{
      actions,
      recordAction,
      undoAction,
      removeAction,
      clearHistory,
    }}>
      {children}
    </SessionHistoryContext.Provider>
  );
};
