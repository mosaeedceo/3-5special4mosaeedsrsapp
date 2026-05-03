import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { AddLessonDialog } from './AddLessonDialog';
import { CategoryData, Difficulty, FabPosition } from '@/types/lesson';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface FabAction {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

interface FloatingAddButtonProps {
  categories: string[];
  categoryData?: CategoryData[];
  existingTags?: string[];
  onAdd?: (lesson: {
    title: string;
    category: string;
    subject: string;
    difficulty: Difficulty;
    startDate?: Date;
    customIntervals?: number[];
    tags?: string[];
  }) => void;
  useFSRS?: boolean;
  position: 'left' | 'right';
  coordinates?: FabPosition;
  onPositionChange?: (position: 'left' | 'right', coordinates?: FabPosition) => void;
  /** When provided, overrides the default Add-Lesson trigger with a popover sheet of actions. */
  actions?: FabAction[];
}

const LONG_PRESS_DURATION = 500;
const BUTTON_SIZE = 56;
const EDGE_PADDING = 16;
const BOTTOM_OFFSET = 120; // Increased for tablet navigation

export const FloatingAddButton = ({
  categories,
  categoryData,
  existingTags,
  onAdd,
  useFSRS,
  position,
  coordinates,
  onPositionChange,
  actions,
}: FloatingAddButtonProps) => {
  const { t, isRTL } = useTranslation();
  const [actionsOpen, setActionsOpen] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    initialTouchRef.current = { x: touch.clientX, y: touch.clientY };
    hasMoved.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      setIsDragging(true);
      setDragPosition({ x: touch.clientX, y: touch.clientY });
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    if (!isDragging && initialTouchRef.current) {
      const deltaX = Math.abs(touch.clientX - initialTouchRef.current.x);
      const deltaY = Math.abs(touch.clientY - initialTouchRef.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
        hasMoved.current = true;
      }
    }
    
    if (isDragging) {
      e.preventDefault();
      setDragPosition({ x: touch.clientX, y: touch.clientY });
    }
  }, [isDragging, clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    
    if (isDragging && dragPosition) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      let finalX = dragPosition.x - BUTTON_SIZE / 2;
      let finalY = dragPosition.y - BUTTON_SIZE / 2;
      
      finalX = Math.max(EDGE_PADDING, Math.min(finalX, screenWidth - BUTTON_SIZE - EDGE_PADDING));
      finalY = Math.max(EDGE_PADDING, Math.min(finalY, screenHeight - BUTTON_SIZE - BOTTOM_OFFSET));
      
      const xPercent = (finalX / screenWidth) * 100;
      const yPercent = (finalY / screenHeight) * 100;
      
      const newPosition = dragPosition.x < screenWidth / 2 ? 'left' : 'right';
      
      if (onPositionChange) {
        onPositionChange(newPosition, { x: xPercent, y: yPercent });
      }
    }
    
    setIsDragging(false);
    setDragPosition(null);
    initialTouchRef.current = null;
  }, [isDragging, dragPosition, onPositionChange, clearLongPressTimer]);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  const getButtonStyle = useCallback((): React.CSSProperties => {
    if (isDragging && dragPosition) {
      return {
        position: 'fixed',
        left: dragPosition.x - BUTTON_SIZE / 2,
        top: dragPosition.y - BUTTON_SIZE / 2,
        bottom: 'auto',
        right: 'auto',
        transform: 'scale(1.1)',
        zIndex: 100,
      };
    }
    
    if (coordinates) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      let left = (coordinates.x / 100) * screenWidth;
      let top = (coordinates.y / 100) * screenHeight;
      
      left = Math.max(EDGE_PADDING, Math.min(left, screenWidth - BUTTON_SIZE - EDGE_PADDING));
      top = Math.max(EDGE_PADDING, Math.min(top, screenHeight - BUTTON_SIZE - BOTTOM_OFFSET));
      
      return {
        position: 'fixed',
        left,
        top,
        bottom: 'auto',
        right: 'auto',
      };
    }
    
    return {
      position: 'fixed',
      bottom: `calc(${BOTTOM_OFFSET}px + env(safe-area-inset-bottom, 0px))`,
      ...(position === 'left' ? { left: EDGE_PADDING } : { right: EDGE_PADDING }),
    };
  }, [isDragging, dragPosition, coordinates, position]);

  const [buttonStyle, setButtonStyle] = useState<React.CSSProperties>(getButtonStyle());

  useEffect(() => {
    const updateStyle = () => {
      setButtonStyle(getButtonStyle());
    };
    
    updateStyle();
    window.addEventListener('resize', updateStyle);
    return () => window.removeEventListener('resize', updateStyle);
  }, [getButtonStyle]);

  return (
    <div 
      ref={buttonRef}
      className={cn(
        'fixed z-50',
        isDragging && 'transition-none'
      )}
      style={buttonStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {actions && actions.length > 0 ? (
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('flashcards.fabAction')}
              className={cn(
                "w-14 h-14 rounded-full shadow-lg flex items-center justify-center gradient-primary text-primary-foreground transition-all duration-300 active:scale-95",
                isDragging
                  ? "shadow-2xl ring-4 ring-primary/30 pointer-events-none"
                  : "hover:shadow-xl hover:scale-105"
              )}
            >
              <Plus className="w-6 h-6" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align={position === 'left' ? 'start' : 'end'}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-56 p-1"
          >
            <div className="flex flex-col">
              {actions.map(a => (
                <button
                  key={a.key}
                  type="button"
                  disabled={a.disabled}
                  onClick={() => {
                    setActionsOpen(false);
                    a.onSelect();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    isRTL && "text-right flex-row-reverse"
                  )}
                >
                  <span className="text-primary shrink-0">{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : onAdd ? (
        <AddLessonDialog
          categories={categories}
          categoryData={categoryData}
          existingTags={existingTags}
          onAdd={onAdd}
          useFSRS={useFSRS}
          triggerClassName={cn(
            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center gradient-primary text-primary-foreground transition-all duration-300 active:scale-95",
            isDragging
              ? "shadow-2xl ring-4 ring-primary/30 pointer-events-none"
              : "hover:shadow-xl hover:scale-105"
          )}
          triggerIcon={<Plus className="w-6 h-6" />}
        />
      ) : null}
    </div>
  );
};
