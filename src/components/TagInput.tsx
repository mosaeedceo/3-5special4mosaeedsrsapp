import { useState, useRef, useMemo, useCallback, KeyboardEvent } from 'react';
import { X, Hash, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  compact?: boolean;
  maxTags?: number;
}

export const TagInput = ({
  tags,
  onChange,
  suggestions = [],
  compact = false,
  maxTags = 10,
}: TagInputProps) => {
  const { t, isRTL } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and exclude already added tags
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const query = inputValue.toLowerCase().replace(/^#/, '');
    return suggestions
      .filter(s => 
        s.toLowerCase().includes(query) && 
        !tags.includes(s)
      )
      .slice(0, 5);
  }, [inputValue, suggestions, tags]);

  const normalizeTag = useCallback((tag: string): string => {
    // Remove # prefix, trim, lowercase, remove special chars except alphanumeric and Arabic
    return tag
      .replace(/^#/, '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]/gu, '');
  }, []);

  const addTag = useCallback((tag: string) => {
    const normalized = normalizeTag(tag);
    if (normalized && !tags.includes(normalized) && tags.length < maxTags) {
      onChange([...tags, normalized]);
      setInputValue('');
      setShowSuggestions(false);
    }
  }, [tags, onChange, normalizeTag, maxTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }, [inputValue, tags, addTag, removeTag]);

  return (
    <div className="space-y-2">
      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn(
                "flex items-center gap-1 pr-1",
                compact ? "text-[10px] h-5 px-1.5" : "text-xs h-6 px-2"
              )}
            >
              <Hash className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                aria-label={t('tags.removeTag')}
              >
                <X className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      {tags.length < maxTags && (
        <div className="relative">
          <div className="flex items-center gap-1">
            <Hash className={cn(
              "text-muted-foreground flex-shrink-0",
              compact ? "w-3 h-3" : "w-4 h-4"
            )} />
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={t('tags.placeholder')}
              className={cn(
                "flex-1",
                compact ? "h-7 text-xs" : "h-8 text-sm"
              )}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {inputValue.trim() && (
              <button
                type="button"
                onClick={() => addTag(inputValue)}
                className={cn(
                  "flex items-center justify-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors",
                  compact ? "w-6 h-6" : "w-8 h-8"
                )}
                aria-label={t('tags.addTag')}
              >
                <Plus className={compact ? "w-3 h-3" : "w-4 h-4"} />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2",
                    compact ? "text-xs" : "text-sm"
                  )}
                >
                  <Hash className="w-3 h-3 text-muted-foreground" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state or hint */}
      {tags.length === 0 && !inputValue && (
        <p className={cn(
          "text-muted-foreground",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {t('tags.noTags')}
        </p>
      )}
    </div>
  );
};
