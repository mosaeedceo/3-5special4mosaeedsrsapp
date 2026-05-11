import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Library, GraduationCap, Layers, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardManagerDialog } from '@/components/CardManagerDialog';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Card as FlashCard } from '@/types/lesson';
import { LibraryPage } from './LibraryPage';
import { CategoriesPage } from './CategoriesPage';

const SESSION_VIEW_KEY = 'browse-view-preference';
type BrowseView = 'library' | 'categories';

const isBrowseView = (v: string | null): v is BrowseView =>
  v === 'library' || v === 'categories';

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export const BrowsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useLocalStorage();
  const { containerClass } = useDisplayMode(data.settings.displayMode);
  const { t } = useTranslation();

  const viewParam = searchParams.get('view');
  const storedView = sessionStorage.getItem(SESSION_VIEW_KEY);
  const view: BrowseView = isBrowseView(viewParam)
    ? viewParam
    : isBrowseView(storedView)
      ? storedView
      : 'library';

  // Global search query lives at the BrowsePage level via URL ?q= so card hits can render above the tabs
  // and persist across Library/Categories tab switches. LibraryPage reads/writes the same param.
  const q = searchParams.get('q') || '';
  const setQ = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('q', v); else next.delete('q');
    setSearchParams(next, { replace: true, state: location.state });
  };

  const [cardHitDeck, setCardHitDeck] = useState<{ id: string; name: string; focusCardId?: string } | null>(null);

  // Ensure URL always reflects the active view, and persist preference.
  useEffect(() => {
    if (viewParam !== view) {
      const next = new URLSearchParams(searchParams);
      next.set('view', view);
      setSearchParams(next, { replace: true, state: location.state });
    }
    sessionStorage.setItem(SESSION_VIEW_KEY, view);
  }, [view, viewParam, searchParams, setSearchParams, location.state]);

  const handleChange = (next: string) => {
    if (!isBrowseView(next) || next === view) return;
    sessionStorage.setItem(SESSION_VIEW_KEY, next);
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    navigate(`/browse?${params.toString()}`, { state: location.state });
  };

  // Search-driven flashcard hits. Strips HTML so card front/back/tags can be matched as plain text.
  const cardSearchHits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as Array<{ card: FlashCard; deckName: string }>;
    const decks = data.decks || [];
    const cards = data.cards || [];
    const stripLower = (html: string) => stripHtml(html).toLowerCase();
    const out: Array<{ card: FlashCard; deckName: string }> = [];
    for (const c of cards) {
      const front = stripLower(c.front || '');
      const back = stripLower(c.back || '');
      const tags = (c.tags || []).join(' ').toLowerCase();
      if (front.includes(query) || back.includes(query) || tags.includes(query)) {
        const deck = decks.find(d => d.id === c.deckId);
        out.push({ card: c, deckName: deck?.name || '' });
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [q, data.cards, data.decks]);

  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          'sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 pt-3 pb-3'
        )}
      >
        <div className={cn(containerClass, 'mx-auto space-y-3')}>
          {/* Global search — drives lesson filtering in Library AND surfaces matching flashcards above the tabs */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              className="pl-9 pr-9 h-10"
              aria-label={t('library.searchPlaceholder')}
            />
            {q && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQ('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

        </div>
      </div>

      {/* Card matches (search-only) — rendered at Browse level so they appear regardless of active tab */}
      {q.trim() && cardSearchHits.length > 0 && (
        <div className="px-4 pt-4">
          <div className={cn(containerClass, 'mx-auto space-y-2')}>
            <h3 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              {t('flashcards.cardsMatching', { count: cardSearchHits.length })}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {cardSearchHits.map(({ card, deckName }) => {
                const front = stripHtml(card.front || '');
                const back = stripHtml(card.back || '');
                // Mirror getDueCards: a card is "due" if it's a new card OR scheduled review is at/before now.
                const isDue = !card.suspended && (!card.fsrs || card.fsrs.state === 'new' || new Date(card.nextReviewDate) <= new Date());
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      if (isDue) {
                        navigate(`/flashcards/${card.deckId}/review`, { state: { jumpToCardId: card.id } });
                      } else {
                        setCardHitDeck({ id: card.deckId, name: deckName, focusCardId: card.id });
                      }
                    }}
                    className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/30 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 truncate max-w-[140px]">
                        <Layers className="w-2.5 h-2.5 mr-1" />
                        {deckName || t('flashcards.title')}
                      </Badge>
                      {isDue && (
                        <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/30">
                          {t('flashcards.dueCount', { count: 1 }).replace(/\d+\s*/, '')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{front || '—'}</p>
                    {back && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{back}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'library' ? <LibraryPage /> : <CategoriesPage />}

      {/* Floating Library / Categories toggle */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center bg-card border border-border shadow-lg rounded-full p-1 gap-1">
          <button
            type="button"
            onClick={() => handleChange('library')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              view === 'library'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Library className="w-4 h-4" />
            <span>{t('nav.library')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange('categories')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              view === 'categories'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <GraduationCap className="w-4 h-4" />
            <span>{t('nav.categories')}</span>
          </button>
        </div>
      </div>

      {/* Card manager (opened from card-search hits when card is not yet due) */}
      {cardHitDeck && (
        <CardManagerDialog
          open={!!cardHitDeck}
          onOpenChange={open => !open && setCardHitDeck(null)}
          deckId={cardHitDeck.id}
          deckName={cardHitDeck.name || cardHitDeck.id}
          focusCardId={cardHitDeck.focusCardId}
        />
      )}
    </div>
  );
};
