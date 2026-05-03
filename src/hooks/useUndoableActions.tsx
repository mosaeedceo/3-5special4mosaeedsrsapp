import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSessionHistory } from '@/contexts/SessionHistoryContext';
import { Lesson, CategoryData, FSRSRating } from '@/types/lesson';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

export const useUndoableActions = () => {
  const storage = useLocalStorage();
  const { recordAction } = useSessionHistory();
  const { t } = useTranslation();

  const deleteLessonWithUndo = useCallback((lessonId: string) => {
    const lesson = storage.data.lessons.find(l => l.id === lessonId);
    if (lesson) {
      recordAction('lesson_deleted', `${t('actions.delete') || 'Deleted'}: ${lesson.title}`, {
        lessonId,
        previousLesson: { ...lesson },
      });
    }
    storage.deleteLesson(lessonId);
  }, [storage, recordAction, t]);

  const addLessonWithUndo = useCallback((lessonData: Parameters<typeof storage.addLesson>[0]) => {
    storage.addLesson(lessonData);
    const addedLesson = storage.data.lessons.find(l => l.title === lessonData.title);
    recordAction('lesson_created', `${t('lesson.addLesson') || 'Created'}: ${lessonData.title}`, {
      lessonId: addedLesson?.id,
    });
  }, [storage, recordAction, t]);

  const editLessonWithUndo = useCallback((lessonId: string, updates: Partial<Lesson>) => {
    const lesson = storage.data.lessons.find(l => l.id === lessonId);
    if (lesson) {
      recordAction('lesson_edited', `${t('lesson.editLesson') || 'Edited'}: ${lesson.title}`, {
        lessonId,
        previousLesson: { ...lesson },
      });
    }
    storage.editLesson(lessonId, updates);
  }, [storage, recordAction, t]);

  const reviewLessonWithUndo = useCallback((lessonId: string, rating: FSRSRating) => {
    const lesson = storage.data.lessons.find(l => l.id === lessonId);
    if (lesson) {
      const ratingLabel = t(`ratings.${rating}`) || rating;
      recordAction('lesson_reviewed', `${t('actions.review') || 'Reviewed'}: ${lesson.title} (${ratingLabel})`, {
        lessonId,
        previousLesson: { ...lesson },
      });
    }
    storage.reviewLesson(lessonId, rating);
  }, [storage, recordAction, t]);

  const snoozeLessonWithUndo = useCallback((lessonId: string, until: Date) => {
    const lesson = storage.data.lessons.find(l => l.id === lessonId);
    if (lesson) {
      recordAction('lesson_snoozed', `${t('snooze.button') || 'Snoozed'}: ${lesson.title}`, {
        lessonId,
        previousLesson: { ...lesson },
      });
    }
    storage.snoozeLesson(lessonId, until);
  }, [storage, recordAction, t]);

  const unsnoozeLessonWithUndo = useCallback((lessonId: string) => {
    const lesson = storage.data.lessons.find(l => l.id === lessonId);
    if (lesson) {
      recordAction('lesson_unsnoozed', `${t('snooze.unsnooze') || 'Unsnoozed'}: ${lesson.title}`, {
        lessonId,
        previousLesson: { ...lesson },
      });
    }
    storage.unsnoozeLesson(lessonId);
  }, [storage, recordAction, t]);

  const batchDeleteWithUndo = useCallback((lessonIds: string[]) => {
    const snapshot = storage.data.lessons.filter(l => lessonIds.includes(l.id));
    if (snapshot.length === 0) return;

    snapshot.forEach(lesson => {
      recordAction('lesson_deleted', `${t('actions.delete') || 'Deleted'}: ${lesson.title}`, {
        lessonId: lesson.id,
        previousLesson: { ...lesson },
      });
    });

    storage.batchDeleteLessons(lessonIds);

    const count = snapshot.length;
    const toastId = toast(
      `${count} ${t('lesson.lessons') || 'lessons'} ${t('actions.deleted') || 'deleted'}`,
      {
        action: {
          label: t('actions.undo') || 'Undo',
          onClick: () => {
            storage.restoreLessons(snapshot);
            toast.dismiss(toastId);
          },
        },
        duration: 5000,
      }
    );
  }, [storage, recordAction, t]);

  const deleteCategoryWithUndo = useCallback((categoryName: string, deleteAllLessons: boolean = false) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    const lessonsInCategory = storage.data.lessons.filter(l => l.category === categoryName);
    
    recordAction('category_deleted', `${t('actions.delete') || 'Deleted'}: ${categoryName}`, {
      categoryName,
      previousCategory: categoryData ? { ...categoryData } : { name: categoryName },
    });
    
    storage.deleteCategory(categoryName, deleteAllLessons);
  }, [storage, recordAction, t]);

  const renameCategoryWithUndo = useCallback((oldName: string, newName: string) => {
    recordAction('category_renamed', `${t('categoryActions.categoryName') || 'Renamed'}: ${oldName} → ${newName}`, {
      categoryName: newName,
      previousCategoryName: oldName,
    });
    storage.renameCategory(oldName, newName);
  }, [storage, recordAction, t]);

  const toggleCategoryMedicalBoardModeWithUndo = useCallback((categoryName: string, enabled: boolean) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    if (categoryData) {
      recordAction('category_settings_changed', 
        `${categoryName}: ${enabled ? t('settings.medicalBoardMode') || 'Medical Board Mode ON' : t('settings.medicalBoardMode') || 'Medical Board Mode OFF'}`, {
        categoryName,
        previousCategory: { ...categoryData },
      });
    }
    storage.toggleCategoryMedicalBoardMode(categoryName, enabled);
  }, [storage, recordAction, t]);

  const toggleCategoryLegacyModeWithUndo = useCallback((categoryName: string, enabled: boolean, intervals?: number[]) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    if (categoryData) {
      recordAction('category_settings_changed', 
        `${categoryName}: ${enabled ? t('legacy.title') || 'Classic Mode ON' : t('legacy.title') || 'Classic Mode OFF'}`, {
        categoryName,
        previousCategory: { ...categoryData },
      });
    }
    storage.toggleCategoryLegacyMode(categoryName, enabled, intervals);
  }, [storage, recordAction, t]);

  const updateCategoryColorWithUndo = useCallback((categoryName: string, color: string | undefined) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    if (categoryData) {
      recordAction('category_settings_changed', 
        `${categoryName}: ${color ? t('categoryActions.cardColor') || 'Color changed' : t('actions.clear') || 'Color cleared'}`, {
        categoryName,
        previousCategory: { ...categoryData },
      });
    }
    storage.updateCategoryColor(categoryName, color);
  }, [storage, recordAction, t]);

  const snoozeCategoryWithUndo = useCallback((categoryName: string, until: Date) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    recordAction('category_snoozed', `${t('snooze.button') || 'Snoozed'}: ${categoryName}`, {
      categoryName,
      previousCategory: categoryData ? { ...categoryData } : { name: categoryName },
    });
    storage.snoozeCategory(categoryName, until);
  }, [storage, recordAction, t]);

  const unsnoozeCategoryWithUndo = useCallback((categoryName: string) => {
    const categoryData = storage.data.categoryData.find(c => c.name === categoryName);
    recordAction('category_unsnoozed', `${t('snooze.unsnooze') || 'Unsnoozed'}: ${categoryName}`, {
      categoryName,
      previousCategory: categoryData ? { ...categoryData } : { name: categoryName },
    });
    storage.unsnoozeCategory(categoryName);
  }, [storage, recordAction, t]);

  return {
    ...storage,
    deleteLessonWithUndo,
    batchDeleteWithUndo,
    addLessonWithUndo,
    editLessonWithUndo,
    reviewLessonWithUndo,
    snoozeLessonWithUndo,
    unsnoozeLessonWithUndo,
    deleteCategoryWithUndo,
    renameCategoryWithUndo,
    toggleCategoryMedicalBoardModeWithUndo,
    toggleCategoryLegacyModeWithUndo,
    updateCategoryColorWithUndo,
    snoozeCategoryWithUndo,
    unsnoozeCategoryWithUndo,
  };
};
