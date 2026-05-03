import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { AppData, Lesson, Settings, DEFAULT_SETTINGS, CategoryData, ActivityRecord, FSRSRating, Deck, Card, EASY_DAY_SCALE } from '@/types/lesson';
import { processCardReview, shouldAutoSuspendAsLeech } from '@/lib/cardFsrs';
import { isNativePlatform } from '@/lib/platform';
import { getData, saveData, getInitialDataSync } from '@/lib/storage';
import { deleteLessonAttachments } from '@/lib/fileCleanup';
import { processReview, migrateToFSRS } from '@/lib/fsrs';
import { migrateTagsToExample } from '@/lib/cardTagsToExampleMigration';
import { prepareAttachmentsForExport, restoreAttachmentsFromImport } from '@/lib/fileUtils';
import { toLocalDateStr, getTodayLocalStr } from '@/lib/date';

const getTodayString = (): string => getTodayLocalStr();

// Reset completed status for lessons whose next review date has passed
// This ensures mastered lessons become due again when it's time to review
const normalizeCompletedLessons = (lessons: Lesson[], categoryData: CategoryData[], useFSRS: boolean): Lesson[] => {
  // Only applies to FSRS mode
  if (!useFSRS) return lessons;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return lessons.map(lesson => {
    // Only process completed lessons
    if (!lesson.completed) return lesson;
    
    // Check if this category is in Medical Board Mode or Legacy Mode
    const category = categoryData.find(c => c.name === lesson.category);
    if (category?.isMedicalBoardMode) return lesson; // Medical Board never resets
    if (category?.isLegacyMode) return lesson; // Legacy mode uses stage-based completion
    
    // Validate nextReviewDate exists and is valid
    if (!lesson.nextReviewDate) return lesson;
    const reviewDate = new Date(lesson.nextReviewDate);
    if (isNaN(reviewDate.getTime())) return lesson; // Invalid date
    
    reviewDate.setHours(0, 0, 0, 0);
    
    if (reviewDate <= now) {
      // Reset completed status - lesson is due again
      return { ...lesson, completed: false };
    }
    
    return lesson;
  });
};

// ============= INTERNAL IMPLEMENTATION (singleton) =============
const useLocalStorageInternal = () => {
  // Initialize with sync data normalized — prevents flash of mastered/snoozed cards on first render
  const [data, setData] = useState<AppData>(() => {
    const raw = getInitialDataSync();
    return {
      ...raw,
      lessons: normalizeCompletedLessons(raw.lessons, raw.categoryData, raw.settings.useFSRS),
    };
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef<AppData>(data);
  const didHydrateRef = useRef(false); // Prevent initial load from re-saving
  const hasPendingChangesRef = useRef(false); // Track user changes before async load completes

  // Keep dataRef in sync with data
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Flush helper: immediately save pending data
  const flushSaveNow = useCallback(() => {
    if (!didHydrateRef.current) return; // Not loaded yet, don't flush
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    saveData(dataRef.current).catch(err => 
      console.error('[useLocalStorage] Error flushing data:', err)
    );
    console.log('[useLocalStorage] Data flushed to storage');
  }, []);

  // Register lifecycle flush events (pagehide, visibilitychange)
  useEffect(() => {
    const handlePageHide = () => {
      console.log('[useLocalStorage] pagehide - flushing');
      flushSaveNow();
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[useLocalStorage] visibilitychange (hidden) - flushing');
        flushSaveNow();
      } else if (document.visibilityState === 'visible') {
        // When app becomes visible, normalize lessons (reset completed if due)
        console.log('[useLocalStorage] visibilitychange (visible) - normalizing lessons');
        setData(prev => ({
          ...prev,
          lessons: normalizeCompletedLessons(prev.lessons, prev.categoryData, prev.settings.useFSRS),
        }));
      }
    };
    
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushSaveNow]);

  // Load data from Preferences on native platform
  useEffect(() => {
    const loadData = async () => {
      // On web, getInitialDataSync already loaded from localStorage
      // Only need async load on native (for Capacitor Preferences)
      if (!isNativePlatform()) {
        didHydrateRef.current = true;
        setIsLoaded(true);
        return;
      }
      
      try {
        const storedData = await getData();
        // Normalize immediately so first render has correct states — no flash
        const normalizedData = {
          ...storedData,
          lessons: normalizeCompletedLessons(storedData.lessons, storedData.categoryData, storedData.settings.useFSRS),
        };

        // Prevent overwriting user changes made during async load
        if (!hasPendingChangesRef.current) {
          setData(normalizedData);
          console.log('[useLocalStorage] Data loaded and normalized from storage');
        } else {
          // User made changes during load - merge carefully (keep user's new lessons)
          setData(prev => ({
            ...normalizedData,
            lessons: prev.lessons.length > 0 ? prev.lessons : normalizedData.lessons,
            activityHistory: prev.activityHistory.length > normalizedData.activityHistory.length 
              ? prev.activityHistory 
              : normalizedData.activityHistory,
          }));
          console.log('[useLocalStorage] Data merged and normalized (user changes preserved)');
        }
      } catch (error) {
        console.error('[useLocalStorage] Error loading data:', error);
      } finally {
        didHydrateRef.current = true;
        setIsLoaded(true);
        hasPendingChangesRef.current = false; // Reset flag after load
      }
    };

    loadData();
  }, []);

  // Normalization is now applied at load time (in useState initializer and async load path)
  // so no separate useEffect is needed here.

  // One-shot migration: recover example sentences that earlier imports
  // accidentally stored as a string of single-word tags. Runs once per
  // user (gated by settings.migrations.tagsToExample) and only after the
  // async hydrate (if any) has populated cards.
  const migrationRanRef = useRef(false);
  useEffect(() => {
    if (migrationRanRef.current) return;
    if (!isLoaded) return;
    if (data.settings.migrations?.tagsToExample) {
      migrationRanRef.current = true;
      return;
    }
    const cards = data.cards || [];
    const result = migrateTagsToExample(cards);
    migrationRanRef.current = true;
    if (result.changedCount > 0) {
      console.log(
        `[useLocalStorage] tagsToExample migration: promoted ${result.changedCount} card(s).`,
      );
    }
    setData(prev => ({
      ...prev,
      cards: result.changedCount > 0 ? result.cards : prev.cards,
      settings: {
        ...prev.settings,
        migrations: {
          ...(prev.settings.migrations || {}),
          tagsToExample: true,
        },
      },
    }));
  }, [isLoaded, data.cards, data.settings.migrations]);

  // Save data whenever it changes (debounced for performance)
  useEffect(() => {
    // Skip until hydration is complete (prevents saving default/stale data)
    if (!didHydrateRef.current) {
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid excessive writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveData(data);
        console.log('[useLocalStorage] Data saved (debounced)');
      } catch (error) {
        console.error('[useLocalStorage] Error saving data:', error);
      }
    }, 100);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Flush pending save immediately on cleanup
        saveData(dataRef.current).catch(err => 
          console.error('[useLocalStorage] Error flushing on cleanup:', err)
        );
      }
    };
  }, [data]); // Removed isLoaded dependency - use didHydrateRef instead

  const recordActivity = useCallback(() => {
    const today = getTodayString();
    // Migration bridge: prior versions keyed activity history by UTC date.
    // If the UTC date differs from the local date, fold any same-day legacy
    // record into the local-date record once so today's count is preserved.
    const utcToday = new Date().toISOString().split('T')[0];
    setData(prev => {
      let working = prev.activityHistory;

      if (utcToday !== today) {
        const legacyIndex = working.findIndex(a => a.date === utcToday);
        if (legacyIndex >= 0) {
          const legacyCount = working[legacyIndex].count;
          const localIndex = working.findIndex(a => a.date === today);
          if (localIndex >= 0) {
            working = working.map((r, i) =>
              i === localIndex ? { ...r, count: r.count + legacyCount } : r
            );
          } else {
            working = [...working, { date: today, count: legacyCount }];
          }
          working = working.filter((_, i) => i !== legacyIndex);
        }
      }

      const existingIndex = working.findIndex(a => a.date === today);
      let newHistory: ActivityRecord[];

      if (existingIndex >= 0) {
        newHistory = working.map((record, idx) =>
          idx === existingIndex ? { ...record, count: record.count + 1 } : record
        );
      } else {
        newHistory = [...working, { date: today, count: 1 }];
      }

      // Keep only last 365 days
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoffDate = toLocalDateStr(oneYearAgo);
      newHistory = newHistory.filter(r => r.date >= cutoffDate);

      return { ...prev, activityHistory: newHistory };
    });
  }, []);

  // Check if a category is in Legacy Mode
  const isCategoryLegacyMode = useCallback((categoryName: string): boolean => {
    return data.categoryData.find(c => c.name === categoryName)?.isLegacyMode || false;
  }, [data.categoryData]);

  // Get legacy intervals for a category
  const getCategoryLegacyIntervals = useCallback((categoryName: string): number[] | undefined => {
    return data.categoryData.find(c => c.name === categoryName)?.legacyIntervals;
  }, [data.categoryData]);

  const addLesson = useCallback((lesson: Omit<Lesson, 'id' | 'dateAdded' | 'nextReviewDate' | 'currentStage' | 'completed' | 'reviewHistory'> & { startDate?: Date; customIntervals?: number[] }) => {
    // Mark as dirty to prevent async load from overwriting
    hasPendingChangesRef.current = true;
    
    const now = new Date();
    const startDate = lesson.startDate || now;
    
    // Check if target category is in Legacy Mode
    const isLegacy = isCategoryLegacyMode(lesson.category);
    const legacyIntervals = getCategoryLegacyIntervals(lesson.category);
    
    // Use legacy intervals if category is in legacy mode, otherwise use custom or global settings
    const baseIntervals = isLegacy 
      ? (legacyIntervals || lesson.customIntervals || data.settings.intervals)
      : (lesson.customIntervals || data.settings.intervals);
    
    // nextReviewDate IS the startDate - no interval added
    const nextReview = new Date(startDate);
    
    // Remove startDate from the lesson object before storing, keep customIntervals
    const { startDate: _, ...lessonWithoutStartDate } = lesson;
    
    const newLesson: Lesson = {
      ...lessonWithoutStartDate,
      id: crypto.randomUUID(),
      dateAdded: now.toISOString(),
      nextReviewDate: nextReview.toISOString(),
      currentStage: 0,
      completed: false,
      reviewHistory: [],
      // Skip FSRS initialization for Legacy Mode categories
      fsrs: (data.settings.useFSRS && !isLegacy) ? {
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 'new' as const,
      } : undefined,
      // Store legacy intervals if in legacy mode
      customIntervals: isLegacy ? baseIntervals : lesson.customIntervals,
    };

    setData(prev => {
      const categories = prev.categories.includes(lesson.category) 
        ? prev.categories 
        : [...prev.categories, lesson.category];
      
      // Ensure categoryData exists for new category
      const categoryData = prev.categoryData.some(c => c.name === lesson.category)
        ? prev.categoryData
        : [...prev.categoryData, { name: lesson.category }];
      
      return {
        ...prev,
        lessons: [...prev.lessons, newLesson],
        categories,
        categoryData,
      };
    });
  }, [data.settings.intervals, data.settings.useFSRS, isCategoryLegacyMode, getCategoryLegacyIntervals]);

  const markLessonDone = useCallback((lessonId: string) => {
    recordActivity();
    
    setData(prev => {
      return {
        ...prev,
        lessons: prev.lessons.map(lesson => {
          if (lesson.id !== lessonId) return lesson;
          
          // Use lesson's custom intervals if available, otherwise use global settings
          const intervals = lesson.customIntervals || prev.settings.intervals;
          
          const nextStage = lesson.currentStage + 1;
          const reviewHistory = [
            ...(lesson.reviewHistory || []),
            { date: new Date().toISOString(), rating: 'good' as FSRSRating },
          ];
          
          if (nextStage >= intervals.length) {
            return { ...lesson, completed: true, reviewHistory };
          }
          
          const nextReview = new Date();
          nextReview.setDate(nextReview.getDate() + intervals[nextStage]);
          
          return {
            ...lesson,
            currentStage: nextStage,
            nextReviewDate: nextReview.toISOString(),
            reviewHistory,
          };
        }),
      };
    });
  }, [recordActivity]);

  // FSRS-based review function
  const reviewLesson = useCallback((lessonId: string, rating: FSRSRating) => {
    recordActivity();
    
    setData(prev => {
      const desiredRetention = prev.settings.desiredRetention || 0.9;
      const masteryThreshold = prev.settings.masteryStabilityDays || 21;
      const useFSRS = prev.settings.useFSRS;
      
      return {
        ...prev,
        lessons: prev.lessons.map(lesson => {
          if (lesson.id !== lessonId) return lesson;
          
          // Check category modes
          const categoryData = prev.categoryData.find(c => c.name === lesson.category);
          const isMedicalBoardMode = categoryData?.isMedicalBoardMode || false;
          const isLegacyMode = categoryData?.isLegacyMode || false;
          
          // For Legacy Mode, use stage-based completion
          if (isLegacyMode) {
            const baseIntervals = lesson.customIntervals || categoryData?.legacyIntervals || prev.settings.intervals;
            const reviewHistory = [
              ...(lesson.reviewHistory || []),
              { date: new Date().toISOString(), rating },
            ];
            
            let nextStage = lesson.currentStage;
            if (rating === 'again') {
              nextStage = Math.max(0, lesson.currentStage - 1);
            } else if (rating === 'hard') {
              nextStage = lesson.currentStage;
            } else if (rating === 'good') {
              nextStage = lesson.currentStage + 1;
            } else if (rating === 'easy') {
              nextStage = lesson.currentStage + 2;
            }
            
            const completed = nextStage >= baseIntervals.length;
            const intervalIndex = Math.min(nextStage, baseIntervals.length - 1);
            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + baseIntervals[intervalIndex]);
            
            return {
              ...lesson,
              currentStage: nextStage,
              nextReviewDate: nextReview.toISOString(),
              reviewHistory,
              completed,
            };
          }
          
          // Process FSRS review for non-legacy categories
          const { fsrsState, nextReviewDate } = processReview(lesson, rating, desiredRetention);
          
          const reviewHistory = [
            ...(lesson.reviewHistory || []),
            { date: new Date().toISOString(), rating },
          ];
          
          // Update stage based on rating (for visual progress tracking)
          const baseIntervals = lesson.customIntervals || prev.settings.intervals;
          let nextStage = lesson.currentStage;
          let completed = lesson.completed;
          
          if (rating === 'again') {
            nextStage = Math.max(0, lesson.currentStage - 1);
          } else if (rating === 'hard') {
            nextStage = lesson.currentStage;
          } else if (rating === 'good') {
            nextStage = lesson.currentStage + 1;
          } else if (rating === 'easy') {
            nextStage = lesson.currentStage + 2;
          }
          
          // Determine completion based on mode
          if (isMedicalBoardMode) {
            completed = false;
          } else if (useFSRS) {
            completed = fsrsState.stability >= masteryThreshold;
          } else {
            if (nextStage >= baseIntervals.length) {
              completed = true;
            }
          }
          
          return {
            ...lesson,
            currentStage: nextStage,
            nextReviewDate: nextReviewDate.toISOString(),
            reviewHistory,
            completed,
            fsrs: fsrsState,
          };
        }),
      };
    });
  }, [recordActivity]);

  // Migrate all lessons to FSRS
  const migrateAllToFSRS = useCallback(() => {
    setData(prev => {
      const intervals = prev.settings.intervals;
      return {
        ...prev,
        lessons: prev.lessons.map(lesson => {
          if (lesson.fsrs) return lesson;
          const categoryData = prev.categoryData.find(c => c.name === lesson.category);
          if (categoryData?.isLegacyMode) return lesson;
          return {
            ...lesson,
            fsrs: migrateToFSRS(lesson, intervals),
          };
        }),
      };
    });
  }, []);

  const deleteLesson = useCallback(async (lessonId: string) => {
    const lessonToDelete = data.lessons.find(l => l.id === lessonId);
    
    if (lessonToDelete && isNativePlatform()) {
      await deleteLessonAttachments(lessonToDelete);
    }
    
    setData(prev => {
      const remainingLessons = prev.lessons.filter(l => l.id !== lessonId);
      const remainingCategoryNames = new Set(remainingLessons.map(l => l.category));
      return {
        ...prev,
        lessons: remainingLessons,
        categoryData: prev.categoryData.filter(c => remainingCategoryNames.has(c.name)),
      };
    });
  }, [data.lessons]);

  const batchDeleteLessons = useCallback(async (lessonIds: string[]) => {
    const idSet = new Set(lessonIds);
    const toDelete = data.lessons.filter(l => idSet.has(l.id));

    if (isNativePlatform()) {
      await Promise.all(toDelete.map(l => deleteLessonAttachments(l)));
    }

    setData(prev => {
      const remainingLessons = prev.lessons.filter(l => !idSet.has(l.id));
      const remainingCategoryNames = new Set(remainingLessons.map(l => l.category));
      return {
        ...prev,
        lessons: remainingLessons,
        categoryData: prev.categoryData.filter(c => remainingCategoryNames.has(c.name)),
      };
    });
  }, [data.lessons]);

  const restoreLessons = useCallback((lessons: Lesson[]) => {
    setData(prev => ({
      ...prev,
      lessons: [...prev.lessons, ...lessons],
    }));
  }, []);

  const editLesson = useCallback((lessonId: string, updates: Partial<Lesson>) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.map(lesson =>
        lesson.id === lessonId ? { ...lesson, ...updates } : lesson
      ),
    }));
  }, []);

  const resetLessonProgress = useCallback((lessonId: string) => {
    setData(prev => {
      const lesson = prev.lessons.find(l => l.id === lessonId);
      if (!lesson) return prev;

      const intervals = lesson.customIntervals || prev.settings.intervals;
      
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + intervals[0]);

      return {
        ...prev,
        lessons: prev.lessons.map(l =>
          l.id === lessonId 
            ? { 
                ...l, 
                currentStage: 0, 
                completed: false, 
                reviewHistory: [], 
                fsrs: undefined,
                nextReviewDate: nextReview.toISOString(),
              } 
            : l
        ),
      };
    });
  }, []);

  const updateSettings = useCallback((settings: Partial<Settings>) => {
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  }, []);

  const updateCategoryExamDate = useCallback((categoryName: string, examDate: string | undefined) => {
    setData(prev => {
      const existingIndex = prev.categoryData.findIndex(c => c.name === categoryName);
      let newCategoryData: CategoryData[];
      
      if (existingIndex >= 0) {
        newCategoryData = prev.categoryData.map((cat, idx) =>
          idx === existingIndex ? { ...cat, examDate } : cat
        );
      } else {
        newCategoryData = [...prev.categoryData, { name: categoryName, examDate }];
      }
      
      return { ...prev, categoryData: newCategoryData };
    });
  }, []);

  const getCategoryExamDate = useCallback((categoryName: string): string | undefined => {
    return data.categoryData.find(c => c.name === categoryName)?.examDate;
  }, [data.categoryData]);

  const isCategoryMedicalBoard = useCallback((categoryName: string): boolean => {
    return data.categoryData.find(c => c.name === categoryName)?.isMedicalBoardMode || false;
  }, [data.categoryData]);

  const toggleCategoryMedicalBoardMode = useCallback((categoryName: string, enabled: boolean) => {
    setData(prev => {
      let updatedCategoryData = [...prev.categoryData];
      const existingIndex = updatedCategoryData.findIndex(c => c.name === categoryName);
      
      if (existingIndex >= 0) {
        updatedCategoryData[existingIndex] = {
          ...updatedCategoryData[existingIndex],
          isMedicalBoardMode: enabled,
          isLegacyMode: enabled ? false : updatedCategoryData[existingIndex].isLegacyMode,
        };
      } else {
        updatedCategoryData.push({ name: categoryName, isMedicalBoardMode: enabled });
      }
      
      let updatedLessons = prev.lessons;
      if (enabled) {
        updatedLessons = prev.lessons.map(lesson => {
          if (lesson.category === categoryName && !lesson.fsrs) {
            return { ...lesson, fsrs: migrateToFSRS(lesson, prev.settings.intervals) };
          }
          return lesson;
        });
      }
      
      return { ...prev, categoryData: updatedCategoryData, lessons: updatedLessons };
    });
  }, []);

  const toggleCategoryLegacyMode = useCallback((categoryName: string, enabled: boolean, intervals?: number[]) => {
    setData(prev => {
      let updatedCategoryData = [...prev.categoryData];
      const existingIndex = updatedCategoryData.findIndex(c => c.name === categoryName);
      
      if (existingIndex >= 0) {
        updatedCategoryData[existingIndex] = {
          ...updatedCategoryData[existingIndex],
          isLegacyMode: enabled,
          legacyIntervals: enabled ? (intervals || prev.settings.intervals) : undefined,
          isMedicalBoardMode: enabled ? false : updatedCategoryData[existingIndex].isMedicalBoardMode,
        };
      } else {
        updatedCategoryData.push({ 
          name: categoryName, 
          isLegacyMode: enabled,
          legacyIntervals: enabled ? (intervals || prev.settings.intervals) : undefined,
        });
      }
      
      return { ...prev, categoryData: updatedCategoryData };
    });
  }, []);

  const updateCategoryLegacyIntervals = useCallback((categoryName: string, intervals: number[]) => {
    setData(prev => {
      const updatedCategoryData = prev.categoryData.map(cat =>
        cat.name === categoryName ? { ...cat, legacyIntervals: intervals } : cat
      );
      return { ...prev, categoryData: updatedCategoryData };
    });
  }, []);

  const getCategoryColor = useCallback((categoryName: string): string | undefined => {
    return data.categoryData.find(c => c.name === categoryName)?.color;
  }, [data.categoryData]);

  const updateCategoryColor = useCallback((categoryName: string, color: string | undefined) => {
    setData(prev => {
      let updatedCategoryData = [...prev.categoryData];
      const existingIndex = updatedCategoryData.findIndex(c => c.name === categoryName);
      
      if (existingIndex >= 0) {
        updatedCategoryData[existingIndex] = {
          ...updatedCategoryData[existingIndex],
          color,
        };
      } else {
        updatedCategoryData.push({ name: categoryName, color });
      }
      
      return { ...prev, categoryData: updatedCategoryData };
    });
  }, []);

  const getDaysUntilExam = useCallback((categoryName: string): number | null => {
    const examDate = getCategoryExamDate(categoryName);
    if (!examDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);
    
    const diffTime = exam.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [getCategoryExamDate]);

  const getExportableSettings = useCallback((settings: typeof data.settings) => {
    const { theme, colorTheme, displayMode, ...exportableSettings } = settings;
    return exportableSettings;
  }, []);

  const exportData = useCallback(async (includeAttachments: boolean = false) => {
    const exportableData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      includesAttachments: includeAttachments,
      data: {
        lessons: includeAttachments 
          ? await prepareAttachmentsForExport(data.lessons)
          : data.lessons.map(l => ({ ...l, attachments: l.attachments?.map(a => ({ ...a, url: undefined })) })),
        categories: data.categories,
        categoryData: data.categoryData,
        activityHistory: data.activityHistory,
        settings: getExportableSettings(data.settings),
      }
    };
    
    const jsonContent = JSON.stringify(exportableData, null, 2);
    const suffix = includeAttachments ? '-full' : '';
    const filename = `medstudy-srs-backup${suffix}-${getTodayLocalStr()}.json`;

    if (isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        await Filesystem.writeFile({
          path: filename,
          data: jsonContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          path: filename,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'MedStudy SRS Backup',
          text: 'Your study data backup',
          files: [fileUri.uri],
          dialogTitle: 'Save or Share Backup',
        });
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      }
    } else {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [data, getExportableSettings]);

  const importData = useCallback(async (jsonString: string) => {
    try {
      let imported: unknown;
      try {
        imported = JSON.parse(jsonString);
      } catch {
        throw new Error('The file is not valid JSON. Please select a valid backup file.');
      }

      if (typeof imported !== 'object' || imported === null) {
        throw new Error('Invalid backup file format.');
      }

      const obj = imported as Record<string, unknown>;
      const isV2 = obj.version === 2 && obj.data != null;
      const importedData = (isV2 ? obj.data : obj) as Record<string, unknown>;

      if (typeof importedData !== 'object' || importedData === null) {
        throw new Error('Invalid backup file: data payload is missing.');
      }

      if (!Array.isArray(importedData.lessons)) {
        throw new Error('Invalid backup file: "lessons" field is missing or not an array.');
      }

      let lessons = importedData.lessons as Lesson[];
      if (isV2 && obj.includesAttachments && isNativePlatform()) {
        lessons = await restoreAttachmentsFromImport(lessons);
      }

      // Migrate legacy reviewHistory entries (string ISO timestamps) to the
      // new { date, rating } object format so imported backups stay compatible.
      lessons = lessons.map(lesson => {
        const history = lesson.reviewHistory as unknown as Array<string | { date: string; rating: FSRSRating }> | undefined;
        if (!history || history.length === 0) return lesson;
        let needsMigration = false;
        const migrated = history.map(entry => {
          if (typeof entry === 'string') {
            needsMigration = true;
            return { date: entry, rating: 'good' as FSRSRating };
          }
          return entry;
        });
        return needsMigration ? { ...lesson, reviewHistory: migrated } : lesson;
      });
      
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(typeof importedData.settings === 'object' && importedData.settings !== null ? importedData.settings : {}),
        theme: data.settings.theme,
        colorTheme: data.settings.colorTheme,
        displayMode: data.settings.displayMode,
      };
      
      const normalized: AppData = {
        lessons,
        settings: mergedSettings as AppData['settings'],
        categories: Array.isArray(importedData.categories) ? importedData.categories as string[] : [],
        categoryData: Array.isArray(importedData.categoryData) ? importedData.categoryData as CategoryData[] : [],
        activityHistory: Array.isArray(importedData.activityHistory) ? importedData.activityHistory as AppData['activityHistory'] : [],
      };
      setData(normalized);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return { error: error instanceof Error ? error.message : 'Failed to import data.' };
    }
  }, [data.settings.theme, data.settings.colorTheme, data.settings.displayMode]);

  const getTodayLessons = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return data.lessons.filter(lesson => {
      if (lesson.completed) return false;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      return reviewDate <= today;
    });
  }, [data.lessons]);

  // Helper to check if a lesson is currently snoozed
  const isLessonSnoozed = useCallback((lesson: Lesson): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check lesson-level snooze
    if (lesson.snoozedUntil) {
      const snoozeEnd = new Date(lesson.snoozedUntil);
      snoozeEnd.setHours(0, 0, 0, 0);
      if (snoozeEnd > today) return true;
    }
    
    // Check category-level snooze
    const categoryData = data.categoryData.find(c => c.name === lesson.category);
    if (categoryData?.snoozedUntil) {
      const categorySnoozeEnd = new Date(categoryData.snoozedUntil);
      categorySnoozeEnd.setHours(0, 0, 0, 0);
      if (categorySnoozeEnd > today) return true;
    }
    
    return false;
  }, [data.categoryData]);

  // Helper to check if a category is snoozed
  const isCategorySnoozed = useCallback((categoryName: string): string | null => {
    const categoryData = data.categoryData.find(c => c.name === categoryName);
    if (!categoryData?.snoozedUntil) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const snoozeEnd = new Date(categoryData.snoozedUntil);
    snoozeEnd.setHours(0, 0, 0, 0);
    
    return snoozeEnd > today ? categoryData.snoozedUntil : null;
  }, [data.categoryData]);

  // Snooze a single lesson
  const snoozeLesson = useCallback((lessonId: string, until: Date) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.map(lesson =>
        lesson.id === lessonId
          ? { 
              ...lesson, 
              snoozedUntil: until.toISOString(),
              nextReviewDate: until.toISOString(),
            }
          : lesson
      ),
    }));
  }, []);

  // Snooze multiple lessons (for bulk actions)
  const snoozeLessons = useCallback((lessonIds: string[], until: Date) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.map(lesson =>
        lessonIds.includes(lesson.id)
          ? { 
              ...lesson, 
              snoozedUntil: until.toISOString(),
              nextReviewDate: until.toISOString(),
            }
          : lesson
      ),
    }));
  }, []);

  // Snooze an entire category
  const snoozeCategory = useCallback((categoryName: string, until: Date) => {
    setData(prev => {
      // Update category data
      let updatedCategoryData = [...prev.categoryData];
      const existingIndex = updatedCategoryData.findIndex(c => c.name === categoryName);
      
      if (existingIndex >= 0) {
        updatedCategoryData[existingIndex] = {
          ...updatedCategoryData[existingIndex],
          snoozedUntil: until.toISOString(),
        };
      } else {
        updatedCategoryData.push({ name: categoryName, snoozedUntil: until.toISOString() });
      }
      
      // Also snooze all current lessons in that category
      const updatedLessons = prev.lessons.map(lesson =>
        lesson.category === categoryName
          ? { 
              ...lesson, 
              snoozedUntil: until.toISOString(),
              nextReviewDate: until.toISOString(),
            }
          : lesson
      );
      
      return { ...prev, categoryData: updatedCategoryData, lessons: updatedLessons };
    });
  }, []);

  // Unsnooze a single lesson
  const unsnoozeLesson = useCallback((lessonId: string) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.map(lesson =>
        lesson.id === lessonId
          ? { ...lesson, snoozedUntil: undefined }
          : lesson
      ),
    }));
  }, []);

  // Unsnooze an entire category
  const unsnoozeCategory = useCallback((categoryName: string) => {
    setData(prev => {
      // Clear category snooze
      const updatedCategoryData = prev.categoryData.map(cat =>
        cat.name === categoryName ? { ...cat, snoozedUntil: undefined } : cat
      );
      
      // Also clear snooze for all lessons in that category
      const updatedLessons = prev.lessons.map(lesson =>
        lesson.category === categoryName
          ? { ...lesson, snoozedUntil: undefined }
          : lesson
      );
      
      return { ...prev, categoryData: updatedCategoryData, lessons: updatedLessons };
    });
  }, []);

  const getMissedLessons = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return data.lessons.filter(lesson => {
      if (lesson.completed) return false;
      // Filter out snoozed lessons
      if (isLessonSnoozed(lesson)) return false;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      return reviewDate < today;
    });
  }, [data.lessons, isLessonSnoozed]);

  const getDueTodayLessons = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return data.lessons.filter(lesson => {
      if (lesson.completed) return false;
      // Filter out snoozed lessons
      if (isLessonSnoozed(lesson)) return false;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      return reviewDate.getTime() === today.getTime();
    });
  }, [data.lessons, isLessonSnoozed]);

  const getMasteryStats = useCallback(() => {
    const total = data.lessons.length;
    if (total === 0) return { completed: 0, inProgress: 0, total: 0, masteryPercentage: 0 };
    
    const masteryThreshold = data.settings.masteryStabilityDays || 21;
    const useFSRS = data.settings.useFSRS;
    
    const completed = useFSRS
      ? data.lessons.filter(l => {
          const categoryData = data.categoryData.find(c => c.name === l.category);
          if (categoryData?.isMedicalBoardMode) return false;
          if (categoryData?.isLegacyMode) return l.completed;
          return (l.fsrs?.stability || 0) >= masteryThreshold;
        }).length
      : data.lessons.filter(l => l.completed).length;
    
    const inProgress = total - completed;
    const masteryPercentage = Math.round((completed / total) * 100);
    
    return { completed, inProgress, total, masteryPercentage };
  }, [data.lessons, data.settings.useFSRS, data.settings.masteryStabilityDays, data.categoryData]);

  const getCategoryStats = useCallback((categoryName: string) => {
    const categoryLessons = data.lessons.filter(l => l.category === categoryName);
    const total = categoryLessons.length;
    const completed = categoryLessons.filter(l => l.completed).length;
    const pending = total - completed;
    const daysUntilExam = getDaysUntilExam(categoryName);
    
    const showWarning = daysUntilExam !== null && daysUntilExam > 0 && pending > 0 && (pending / daysUntilExam) > 3;
    
    return { total, completed, pending, daysUntilExam, showWarning };
  }, [data.lessons, getDaysUntilExam]);

  const renameCategory = useCallback((oldName: string, newName: string) => {
    setData(prev => {
      const categories = prev.categories.map(c => c === oldName ? newName : c);
      const categoryData = prev.categoryData.map(c => 
        c.name === oldName ? { ...c, name: newName } : c
      );
      const lessons = prev.lessons.map(l => 
        l.category === oldName ? { ...l, category: newName } : l
      );
      
      return { ...prev, categories, categoryData, lessons };
    });
  }, []);

  const deleteCategory = useCallback((categoryName: string, deleteAllLessons: boolean = false) => {
    setData(prev => {
      let categories = prev.categories.filter(c => c !== categoryName);
      
      if (!deleteAllLessons && !categories.includes('Uncategorized')) {
        categories = [...categories, 'Uncategorized'];
      }
      
      let categoryData = prev.categoryData.filter(c => c.name !== categoryName);
      
      if (!deleteAllLessons && !categoryData.some(c => c.name === 'Uncategorized')) {
        categoryData = [...categoryData, { name: 'Uncategorized' }];
      }
      
      const lessons = deleteAllLessons 
        ? prev.lessons.filter(l => l.category !== categoryName)
        : prev.lessons.map(l => 
            l.category === categoryName ? { ...l, category: 'Uncategorized' } : l
          );
      
      return { ...prev, categories, categoryData, lessons };
    });
  }, []);

  const duplicateLesson = useCallback((lessonId: string) => {
    const lessonToDuplicate = data.lessons.find(l => l.id === lessonId);
    if (!lessonToDuplicate) return;

    const now = new Date();
    const intervals = lessonToDuplicate.customIntervals || data.settings.intervals;
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervals[0]);

    const duplicatedLesson: Lesson = {
      ...lessonToDuplicate,
      id: crypto.randomUUID(),
      title: `${lessonToDuplicate.title} (Copy)`,
      dateAdded: now.toISOString(),
      nextReviewDate: nextReview.toISOString(),
      currentStage: 0,
      completed: false,
      reviewHistory: [],
      fsrs: undefined,
      attachments: undefined,
    };

    setData(prev => ({
      ...prev,
      lessons: [...prev.lessons, duplicatedLesson],
    }));
  }, [data.lessons, data.settings.intervals]);

  const mergeLessons = useCallback((
    lessonIds: string[], 
    mergedData: {
      title: string;
      category: string;
      subject: string;
      difficulty: Lesson['difficulty'];
      includeNotes: string[];
      includeAttachments: string[];
    }
  ) => {
    const lessonsToMerge = data.lessons.filter(l => lessonIds.includes(l.id));
    if (lessonsToMerge.length < 2) return;

    const lowestStabilityLesson = lessonsToMerge.reduce((lowest, current) => {
      const currentStability = current.fsrs?.stability || 0;
      const lowestStability = lowest.fsrs?.stability || 0;
      return currentStability < lowestStability ? current : lowest;
    }, lessonsToMerge[0]);

    const combinedNotes = lessonsToMerge
      .filter(l => mergedData.includeNotes.includes(l.id) && l.notes)
      .map(l => `--- ${l.title} ---\n${l.notes}`)
      .join('\n\n');

    const combinedAttachments = lessonsToMerge
      .filter(l => mergedData.includeAttachments.includes(l.id) && l.attachments)
      .flatMap(l => l.attachments || []);

    const now = new Date();
    const intervals = data.settings.intervals;
    
    const fsrsState = lowestStabilityLesson.fsrs ? { ...lowestStabilityLesson.fsrs } : undefined;
    
    const nextReview = new Date();
    if (fsrsState) {
      nextReview.setDate(nextReview.getDate() + (fsrsState.scheduledDays || intervals[0]));
    } else {
      nextReview.setDate(nextReview.getDate() + intervals[0]);
    }

    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      title: mergedData.title,
      category: mergedData.category,
      subject: mergedData.subject,
      difficulty: mergedData.difficulty,
      dateAdded: now.toISOString(),
      nextReviewDate: nextReview.toISOString(),
      currentStage: lowestStabilityLesson.currentStage || 0,
      completed: false,
      reviewHistory: [],
      notes: combinedNotes || undefined,
      attachments: combinedAttachments.length > 0 ? combinedAttachments : undefined,
      fsrs: fsrsState,
    };

    setData(prev => ({
      ...prev,
      lessons: [
        ...prev.lessons.filter(l => !lessonIds.includes(l.id)),
        newLesson,
      ],
    }));

    recordActivity();
  }, [data.lessons, data.settings.intervals, recordActivity]);

  const restoreLesson = useCallback((lesson: Lesson) => {
    setData(prev => {
      const existingIndex = prev.lessons.findIndex(l => l.id === lesson.id);
      if (existingIndex >= 0) {
        const updatedLessons = [...prev.lessons];
        updatedLessons[existingIndex] = lesson;
        return { ...prev, lessons: updatedLessons };
      } else {
        return { ...prev, lessons: [...prev.lessons, lesson] };
      }
    });
  }, []);

  const restoreCategory = useCallback((categoryData: CategoryData) => {
    setData(prev => {
      const existingCategoryIndex = prev.categoryData.findIndex(c => c.name === categoryData.name);
      let updatedCategoryData = [...prev.categoryData];
      
      if (existingCategoryIndex >= 0) {
        updatedCategoryData[existingCategoryIndex] = categoryData;
      } else {
        updatedCategoryData.push(categoryData);
      }
      
      const categories = prev.categories.includes(categoryData.name)
        ? prev.categories
        : [...prev.categories, categoryData.name];
        
      return { ...prev, categories, categoryData: updatedCategoryData };
    });
  }, []);

  const updateCategoryData = useCallback((categoryData: CategoryData) => {
    setData(prev => {
      const existingIndex = prev.categoryData.findIndex(c => c.name === categoryData.name);
      let updatedCategoryData = [...prev.categoryData];
      
      if (existingIndex >= 0) {
        updatedCategoryData[existingIndex] = categoryData;
      } else {
        updatedCategoryData.push(categoryData);
      }
      
      return { ...prev, categoryData: updatedCategoryData };
    });
  }, []);

  // ============= FLASHCARDS (DECKS + CARDS) =============

  const addDeck = useCallback((deck: Omit<Deck, 'id' | 'dateAdded'>): Deck => {
    const newDeck: Deck = {
      ...deck,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      decks: [...(prev.decks || []), newDeck],
    }));
    return newDeck;
  }, []);

  const renameDeck = useCallback((deckId: string, name: string) => {
    setData(prev => ({
      ...prev,
      decks: (prev.decks || []).map(d => d.id === deckId ? { ...d, name } : d),
    }));
  }, []);

  const updateDeck = useCallback((deckId: string, updates: Partial<Deck>) => {
    setData(prev => ({
      ...prev,
      decks: (prev.decks || []).map(d => d.id === deckId ? { ...d, ...updates, id: d.id } : d),
    }));
  }, []);

  const deleteDeck = useCallback(async (deckId: string) => {
    // Clean up media files on native
    const cardsToDelete = (dataRef.current.cards || []).filter(c => c.deckId === deckId);
    if (isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        for (const card of cardsToDelete) {
          for (const m of card.media || []) {
            if (!m.localPath) continue;
            // localPath is a full URI; derive relative path under Directory.Data
            const idx = m.localPath.indexOf('attachments/');
            if (idx === -1) continue;
            const relPath = m.localPath.substring(idx);
            try {
              await Filesystem.deleteFile({ path: relPath, directory: Directory.Data });
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        console.warn('[deleteDeck] media cleanup failed', e);
      }
    }
    setData(prev => ({
      ...prev,
      decks: (prev.decks || []).filter(d => d.id !== deckId),
      cards: (prev.cards || []).filter(c => c.deckId !== deckId),
      lessons: prev.lessons.map(l =>
        l.linkedDeckId === deckId ? { ...l, linkedDeckId: undefined } : l,
      ),
    }));
  }, []);

  const getLessonsForDeck = useCallback((deckId: string): Lesson[] => {
    return data.lessons.filter(l => l.linkedDeckId === deckId);
  }, [data.lessons]);

  const addCards = useCallback((cards: Card[]) => {
    setData(prev => ({
      ...prev,
      cards: [...(prev.cards || []), ...cards],
    }));
  }, []);

  const updateCard = useCallback((cardId: string, updates: Partial<Card>) => {
    setData(prev => ({
      ...prev,
      cards: (prev.cards || []).map(c =>
        c.id === cardId ? { ...c, ...updates, id: c.id, deckId: c.deckId } : c,
      ),
    }));
  }, []);

  /** Replace the entire cards array (used by bulk migrations like the
   *  manual "Clean up imported tags" action). */
  const replaceCards = useCallback((cards: Card[]) => {
    setData(prev => ({ ...prev, cards }));
  }, []);

  const deleteCard = useCallback(async (cardId: string) => {
    const card = (dataRef.current.cards || []).find(c => c.id === cardId);
    if (card && isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        for (const m of card.media || []) {
          if (!m.localPath) continue;
          const idx = m.localPath.indexOf('attachments/');
          if (idx === -1) continue;
          const relPath = m.localPath.substring(idx);
          try {
            await Filesystem.deleteFile({ path: relPath, directory: Directory.Data });
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.warn('[deleteCard] media cleanup failed', e);
      }
    }
    setData(prev => ({
      ...prev,
      cards: (prev.cards || []).filter(c => c.id !== cardId),
    }));
  }, []);

  const reviewCard = useCallback((
    cardId: string,
    rating: FSRSRating,
  ): { leechSuspended: boolean } => {
    // Compute the next FSRS state and leech decision synchronously off the
    // current data snapshot so callers (DeckReviewPage) can react to a
    // suspension immediately. The `setData` updater below would set this
    // flag too late — it runs after the function returns.
    const current = dataRef.current;
    const card = (current.cards || []).find(c => c.id === cardId);
    if (!card) return { leechSuspended: false };

    // Per-deck overrides take precedence over the global setting.
    const deck = (current.decks || []).find(d => d.id === card.deckId);
    const retention =
      deck?.desiredRetentionOverride ?? current.settings.desiredRetention ?? 0.9;
    const { fsrsState, nextReviewDate } = processCardReview(card, rating, retention);
    const historyEntry = {
      date: new Date().toISOString(),
      rating,
      stability: fsrsState.stability,
      difficulty: fsrsState.difficulty,
    };
    const threshold =
      deck?.leechThresholdOverride ?? current.settings.leechThreshold ?? 0;
    const leechSuspended = shouldAutoSuspendAsLeech(fsrsState, card.suspended, threshold);

    setData(prev => {
      const cards = prev.cards || [];
      const target = cards.find(c => c.id === cardId);
      if (!target) return prev;
      const updatedCard: Card = {
        ...target,
        fsrs: fsrsState,
        nextReviewDate: nextReviewDate.toISOString(),
        reviewHistory: [...(target.reviewHistory || []), historyEntry],
        ...(leechSuspended ? { suspended: true } : {}),
      };
      return {
        ...prev,
        cards: cards.map(c => c.id === cardId ? updatedCard : c),
      };
    });
    // Record into the shared daily activity history so flashcard reviews
    // count toward the home screen's "reviewed today" counter, the streak,
    // the activity heatmap, and the weekly progress chart, just like
    // lesson reviews do (see reviewLesson / markLessonDone).
    recordActivity();
    return { leechSuspended };
  }, [recordActivity]);

  const getDeckCards = useCallback((deckId: string): Card[] => {
    return (data.cards || []).filter(c => c.deckId === deckId);
  }, [data.cards]);

  /**
   * Live count of items due today that the daily reminder should mention.
   * Mirrors the home screen: non-snoozed lessons due today/overdue, plus
   * non-suspended cards across all decks that are due now (or new).
   */
  const getTodayDueCount = useCallback((): {
    lessons: number;
    cards: number;
    total: number;
  } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lessonsCount = data.lessons.filter(lesson => {
      if (lesson.completed) return false;
      if (isLessonSnoozed(lesson)) return false;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      return reviewDate <= today;
    }).length;
    const now = new Date();
    let cardsCount = 0;
    for (const c of data.cards || []) {
      if (c.suspended) continue;
      if (!c.fsrs || c.fsrs.state === 'new') {
        cardsCount += 1;
      } else if (new Date(c.nextReviewDate) <= now) {
        cardsCount += 1;
      }
    }
    return { lessons: lessonsCount, cards: cardsCount, total: lessonsCount + cardsCount };
  }, [data.lessons, data.cards, isLessonSnoozed]);

  const getDueCards = useCallback((deckId: string): Card[] => {
    const now = new Date();
    const deckCards = (data.cards || []).filter(c => c.deckId === deckId && !c.suspended);
    const newCards: Card[] = [];
    const dueCards: Card[] = [];
    for (const c of deckCards) {
      if (!c.fsrs || c.fsrs.state === 'new') {
        newCards.push(c);
      } else if (new Date(c.nextReviewDate) <= now) {
        dueCards.push(c);
      }
    }
    const deck = (data.decks || []).find(d => d.id === deckId);
    let newLimit = deck?.newPerDay ?? 20;
    let reviewLimit = deck?.reviewsPerDay ?? 200;

    // Easy Days: scale today's allowance by the configured weekday level.
    // weekdays array uses Mon..Sun ordering (index 0 = Monday).
    if (deck?.easyDays && deck.easyDays.length === 7) {
      const jsDow = now.getDay(); // 0=Sun..6=Sat
      const idx = (jsDow + 6) % 7; // 0=Mon..6=Sun
      const level = deck.easyDays[idx];
      const scale = EASY_DAY_SCALE[level] ?? 1;
      reviewLimit = Math.max(0, Math.floor(reviewLimit * scale));
      newLimit = Math.max(0, Math.floor(newLimit * scale));
    }

    // Today-only bumps from Custom Study; cleared automatically once date rolls over.
    const todayKey = toLocalDateStr(now);
    const bumps =
      deck?.todayBumps && deck.todayBumps.date === todayKey
        ? deck.todayBumps
        : null;
    if (bumps?.extraNew) newLimit += bumps.extraNew;
    if (bumps?.extraReviews) reviewLimit += bumps.extraReviews;

    const cappedReviews = dueCards.slice(0, reviewLimit);
    let cappedNew = newCards.slice(0, newLimit);

    // When new cards count against the review cap, shrink new to fit the headroom.
    if (!deck?.newCardsIgnoreReviewLimit) {
      const headroom = Math.max(0, reviewLimit - cappedReviews.length);
      cappedNew = cappedNew.slice(0, headroom);
    }

    return deck?.limitsStartFromTop
      ? [...cappedNew, ...cappedReviews]
      : [...cappedReviews, ...cappedNew];
  }, [data.cards, data.decks]);

  /**
   * Custom Study card selection. Bypasses normal daily-limit / due-date logic
   * and returns up to `limit` cards matching the provided filter, scoped to a
   * single deck. Used by the Custom Study buttons in Deck Settings.
   */
  const getCustomStudyCards = useCallback((
    deckId: string,
    filter:
      | { type: 'forgotten'; limit: number }
      | { type: 'ahead'; limit: number; days: number }
      | { type: 'previewNew'; limit: number }
      | { type: 'state'; state: 'new' | 'learning' | 'review' | 'relearning'; limit: number }
      | { type: 'tag'; tag: string; limit: number },
  ): Card[] => {
    const all = (data.cards || []).filter(c => c.deckId === deckId && !c.suspended);
    let pool: Card[] = [];
    switch (filter.type) {
      case 'forgotten':
        pool = all.filter(c => (c.fsrs?.lapses ?? 0) > 0);
        break;
      case 'ahead': {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + Math.max(1, filter.days));
        pool = all.filter(
          c => c.fsrs && c.fsrs.state !== 'new' && new Date(c.nextReviewDate) <= cutoff,
        );
        // Soonest-due first to mirror normal review order.
        pool.sort(
          (a, b) =>
            new Date(a.nextReviewDate).getTime() -
            new Date(b.nextReviewDate).getTime(),
        );
        break;
      }
      case 'previewNew':
        pool = all.filter(c => !c.fsrs || c.fsrs.state === 'new');
        break;
      case 'state':
        pool = all.filter(c => (c.fsrs?.state ?? 'new') === filter.state);
        break;
      case 'tag': {
        const needle = filter.tag.trim().toLowerCase();
        pool = needle
          ? all.filter(c => (c.tags || []).some(t => t.toLowerCase() === needle))
          : [];
        break;
      }
    }
    return pool.slice(0, Math.max(0, filter.limit));
  }, [data.cards]);

  return {
    data,
    isLoaded,
    addLesson,
    markLessonDone,
    reviewLesson,
    migrateAllToFSRS,
    deleteLesson,
    batchDeleteLessons,
    restoreLessons,
    editLesson,
    resetLessonProgress,
    duplicateLesson,
    mergeLessons,
    updateSettings,
    updateCategoryExamDate,
    getCategoryExamDate,
    getDaysUntilExam,
    isCategoryMedicalBoard,
    toggleCategoryMedicalBoardMode,
    isCategoryLegacyMode,
    toggleCategoryLegacyMode,
    getCategoryLegacyIntervals,
    updateCategoryLegacyIntervals,
    getCategoryColor,
    updateCategoryColor,
    exportData,
    importData,
    getTodayLessons,
    getMissedLessons,
    getDueTodayLessons,
    getMasteryStats,
    getCategoryStats,
    renameCategory,
    deleteCategory,
    // Snooze functions
    isLessonSnoozed,
    isCategorySnoozed,
    snoozeLesson,
    snoozeLessons,
    snoozeCategory,
    unsnoozeLesson,
    unsnoozeCategory,
    // Restore functions for undo
    restoreLesson,
    restoreCategory,
    updateCategoryData,
    // Flashcards
    addDeck,
    renameDeck,
    updateDeck,
    deleteDeck,
    addCards,
    updateCard,
    replaceCards,
    deleteCard,
    reviewCard,
    getDeckCards,
    getDueCards,
    getCustomStudyCards,
    getTodayDueCount,
    getLessonsForDeck,
  };
};

// ============= CONTEXT + PROVIDER (singleton pattern) =============
type LocalStorageContextType = ReturnType<typeof useLocalStorageInternal>;

const LocalStorageContext = createContext<LocalStorageContextType | null>(null);

export const LocalStorageProvider = ({ children }: { children: ReactNode }) => {
  const store = useLocalStorageInternal();
  return (
    <LocalStorageContext.Provider value={store}>
      {children}
    </LocalStorageContext.Provider>
  );
};

// ============= PUBLIC HOOK (reads from Context) =============
export const useLocalStorage = (): LocalStorageContextType => {
  const ctx = useContext(LocalStorageContext);
  if (!ctx) {
    throw new Error('useLocalStorage must be used within LocalStorageProvider');
  }
  return ctx;
};
