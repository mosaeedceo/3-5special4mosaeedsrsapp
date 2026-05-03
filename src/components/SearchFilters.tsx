import { Search, Filter, X, Hash, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Difficulty } from '@/types/lesson';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'due-today' | 'completed' | 'missed' | 'upcoming' | 'snoozed';
export type SortOption = 'dueSoonest' | 'titleAZ' | 'newestFirst' | 'memoryStrength';

interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  difficultyFilter: string;
  onDifficultyChange: (difficulty: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  tagFilter?: string;
  onTagChange?: (tag: string) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  categories: string[];
  availableTags?: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const SearchFilters = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  difficultyFilter,
  onDifficultyChange,
  statusFilter,
  onStatusChange,
  tagFilter = 'all',
  onTagChange,
  sortBy = 'dueSoonest',
  onSortChange,
  categories,
  availableTags = [],
  onClearFilters,
  hasActiveFilters,
}: SearchFiltersProps) => {
  const { t, isRTL } = useTranslation();

  return (
    <div className="space-y-2">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-9"
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>

      {/* Filters Row */}
      <div className="flex gap-1.5 flex-wrap">
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[110px] sm:w-[130px] h-8 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
            <Filter className={cn("w-3 h-3", isRTL ? "ml-1" : "mr-1")} />
            <SelectValue placeholder={t('filters.category')} />
          </SelectTrigger>
          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficultyFilter} onValueChange={onDifficultyChange}>
          <SelectTrigger className="w-[80px] sm:w-[100px] h-8 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectValue placeholder={t('filters.difficulty')} />
          </SelectTrigger>
          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all">{t('filters.allLevels')}</SelectItem>
            <SelectItem value="Easy">{t('difficulties.Easy')}</SelectItem>
            <SelectItem value="Medium">{t('difficulties.Medium')}</SelectItem>
            <SelectItem value="Hard">{t('difficulties.Hard')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
          <SelectTrigger className="w-[80px] sm:w-[100px] h-8 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
            <SelectItem value="due-today">{t('filters.dueToday')}</SelectItem>
            <SelectItem value="missed">{t('filters.missed')}</SelectItem>
            <SelectItem value="upcoming">{t('filters.upcoming')}</SelectItem>
            <SelectItem value="completed">{t('filters.completed')}</SelectItem>
            <SelectItem value="snoozed">{t('filters.snoozed')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort - only shown when onSortChange provided */}
        {onSortChange && (
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="w-[100px] sm:w-[130px] h-8 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
              <ArrowUpDown className={cn("w-3 h-3", isRTL ? "ml-1" : "mr-1")} />
              <SelectValue placeholder={t('library.sortBy')} />
            </SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="dueSoonest">{t('library.sort.dueSoonest')}</SelectItem>
              <SelectItem value="titleAZ">{t('library.sort.titleAZ')}</SelectItem>
              <SelectItem value="newestFirst">{t('library.sort.newestFirst')}</SelectItem>
              <SelectItem value="memoryStrength">{t('library.sort.memoryStrength')}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Tag Filter - only show if there are tags */}
        {(availableTags.length > 0 || tagFilter !== 'all') && onTagChange && (
          <Select value={tagFilter} onValueChange={onTagChange}>
            <SelectTrigger className="w-[80px] sm:w-[100px] h-8 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
              <Hash className={cn("w-3 h-3", isRTL ? "ml-1" : "mr-1")} />
              <SelectValue placeholder={t('filters.tags')} />
            </SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="all">{t('filters.allTags')}</SelectItem>
              {availableTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  #{tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 text-xs px-2">
            <X className="w-3 h-3 mr-1" />
            {t('filters.clear')}
          </Button>
        )}
      </div>
    </div>
  );
};
