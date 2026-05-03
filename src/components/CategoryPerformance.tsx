import { Lesson, CategoryData } from '@/types/lesson';
import { AlertTriangle, Trophy, BookOpen, GraduationCap, Infinity, Brain, ChevronRight } from 'lucide-react';
import { calculateRetrievability } from '@/lib/fsrs';

interface CategoryPerformanceProps {
  lessons: Lesson[];
  categories: string[];
  categoryData: CategoryData[];
  getDaysUntilExam: (category: string) => number | null;
  onCategoryClick?: (category: string) => void;
}

export const CategoryPerformance = ({ 
  lessons, 
  categories,
  categoryData,
  getDaysUntilExam,
  onCategoryClick
}: CategoryPerformanceProps) => {
  if (categories.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No categories yet
      </div>
    );
  }

  const getCategoryData = (category: string) => {
    const categoryLessons = lessons.filter(l => l.category === category);
    const total = categoryLessons.length;
    const completed = categoryLessons.filter(l => l.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const daysUntilExam = getDaysUntilExam(category);
    
    // T004: Categories "pending" count should reflect due today/missed, not all-time
    const dueCount = lessons.filter(l => {
      if (l.category !== category || l.completed) return false;
      const reviewDate = new Date(l.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return reviewDate <= today;
    }).length;
    
    const pending = dueCount;
    const showWarning = daysUntilExam !== null && daysUntilExam > 0 && pending > 0 && (pending / daysUntilExam) > 3;
    
    // Check if Medical Board Mode
    const isMedBoard = categoryData.find(c => c.name === category)?.isMedicalBoardMode || false;
    
    // Medical Board stats
    const lessonsWithFSRS = categoryLessons.filter(l => l.fsrs);
    const avgStability = lessonsWithFSRS.length > 0
      ? Math.round(lessonsWithFSRS.reduce((sum, l) => sum + (l.fsrs?.stability || 0), 0) / lessonsWithFSRS.length)
      : 0;
    const matureCount = categoryLessons.filter(l => (l.fsrs?.stability || 0) >= 21).length;
    const maturePercentage = total > 0 ? Math.round((matureCount / total) * 100) : 0;
    
    return { total, completed, percentage, daysUntilExam, showWarning, pending, isMedBoard, avgStability, matureCount, maturePercentage };
  };

  return (
    <div className="grid gap-3">
      {categories.map(category => {
        const data = getCategoryData(category);
        
        return (
          <div 
            key={category} 
            onClick={() => onCategoryClick?.(category)}
            className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${
              data.isMedBoard 
                ? 'border-primary/40 bg-primary/5'
                : data.showWarning 
                  ? 'border-danger/50 bg-danger/5' 
                  : 'border-border bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2 pr-4">
              <div className="flex items-center gap-2">
                {data.isMedBoard ? (
                  <GraduationCap className="w-4 h-4 text-primary" />
                ) : (
                  <BookOpen className="w-4 h-4 text-primary" />
                )}
                <span className="font-medium text-foreground text-sm truncate max-w-32">
                  {category}
                </span>
                {data.isMedBoard && (
                  <Infinity className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div className="flex items-center gap-1">
                {data.showWarning && !data.isMedBoard && (
                  <AlertTriangle className="w-4 h-4 text-danger" />
                )}
                {!data.isMedBoard && data.percentage === 100 && (
                  <Trophy className="w-4 h-4 text-success" />
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${data.isMedBoard ? data.maturePercentage : data.percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground w-10 text-right">
                {data.isMedBoard ? data.maturePercentage : data.percentage}%
              </span>
            </div>
            
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              {data.isMedBoard ? (
                <>
                  <span className="flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    {data.avgStability}d stability
                  </span>
                  <span>{data.matureCount}/{data.total} mature</span>
                </>
              ) : (
                <>
                  <span>{data.completed}/{data.total} mastered</span>
                  {data.daysUntilExam !== null && (
                    <span className={data.showWarning ? 'text-danger font-medium' : ''}>
                      {data.daysUntilExam > 0 ? `${data.daysUntilExam}d to exam` : 'Exam today!'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
