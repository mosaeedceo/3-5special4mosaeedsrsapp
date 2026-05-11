import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, Trash2, Plus, ClipboardPaste, Pause, Play, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { sanitizeCardHtml } from '@/lib/cardMedia';
import { Card as FlashCard } from '@/types/lesson';
import { CardEditorDialog } from './CardEditorDialog';
import { BulkAddCardsDialog } from './BulkAddCardsDialog';
import { cardDedupeKey, type ParsedTextRow } from '@/lib/cardTextParser';
import { migrateTagsToExample } from '@/lib/cardTagsToExampleMigration';
import { cn } from '@/lib/utils';

interface CardManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
  /** Optional card to scroll to and highlight when the dialog opens. */
  focusCardId?: string;
  /** Status filter to apply each time the dialog is opened. */
  initialStatusFilter?: 'all' | 'active' | 'suspended';
}

export const CardManagerDialog = ({
  open,
  onOpenChange,
  deckId,
  deckName,
  focusCardId,
  initialStatusFilter,
}: CardManagerDialogProps) => {
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const { data, addCards, updateCard, deleteCard, replaceCards } = useLocalStorage();

  const [editingCard, setEditingCard] = useState<FlashCard | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const lastFocusedRef = useRef<string | null>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const allDeckCards = useMemo(
    () => (data.cards || []).filter(c => c.deckId === deckId),
    [data.cards, deckId],
  );

  const deckCards = useMemo(() => {
    if (statusFilter === 'active') return allDeckCards.filter(c => !c.suspended);
    if (statusFilter === 'suspended') return allDeckCards.filter(c => !!c.suspended);
    return allDeckCards;
  }, [allDeckCards, statusFilter]);

  const suspendedCount = useMemo(
    () => allDeckCards.filter(c => c.suspended).length,
    [allDeckCards],
  );

  // Virtualize the card list so dialogs with thousands of cards open and
  // scroll smoothly. Heights vary (line-clamp + tags + suspended badge)
  // so we use measureElement to learn each row's real size after mount.
  const rowVirtualizer = useVirtualizer({
    count: deckCards.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 110,
    overscan: 6,
    getItemKey: index => deckCards[index]?.id ?? index,
    measureElement:
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? element => element.getBoundingClientRect().height
        : undefined,
  });

  // Scroll the focused card into view + highlight it. With virtualization
  // the row may not be mounted yet, so we use the virtualizer's
  // scrollToIndex which both scrolls and forces the row to render.
  useEffect(() => {
    if (!open) {
      lastFocusedRef.current = null;
      setHighlightId(null);
      return;
    }
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
    if (!focusCardId || lastFocusedRef.current === focusCardId) return;
    lastFocusedRef.current = focusCardId;
    // Defer until the list has rendered after the dialog opens.
    const t1 = window.setTimeout(() => {
      const idx = deckCards.findIndex(c => c.id === focusCardId);
      if (idx >= 0) {
        rowVirtualizer.scrollToIndex(idx, { align: 'center' });
      }
      setHighlightId(focusCardId);
    }, 80);
    const t2 = window.setTimeout(() => setHighlightId(null), 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // rowVirtualizer is stable enough; deckCards is included so a late
    // status-filter switch (see below) still finds the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusCardId, initialStatusFilter, deckId, deckCards]);

  // If a focus card lands in a filter that hides it, switch to All so it
  // becomes visible. Also clear lastFocusedRef so the focus-scroll effect
  // re-runs against the now-visible deckCards list and centers the row.
  useEffect(() => {
    if (!focusCardId) return;
    const target = allDeckCards.find(c => c.id === focusCardId);
    if (!target) return;
    if (
      (statusFilter === 'active' && target.suspended) ||
      (statusFilter === 'suspended' && !target.suspended)
    ) {
      lastFocusedRef.current = null;
      setStatusFilter('all');
    }
    // We only want to reconcile once per focus change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCardId, allDeckCards]);

  const toggleSuspend = (card: FlashCard) => {
    const next = !card.suspended;
    updateCard(card.id, { suspended: next });
    toast({
      title: next ? t('flashcards.cardSuspended') : t('flashcards.cardUnsuspended'),
    });
  };

  const openCreate = () => {
    setEditingCard(null);
    setEditorMode('create');
    setEditorOpen(true);
  };

  const openEdit = (card: FlashCard) => {
    setEditingCard(card);
    setEditorMode('edit');
    setEditorOpen(true);
  };

  const handleSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    example?: string;
  }) => {
    if (editorMode === 'create') {
      const now = new Date().toISOString();
      const newCard: FlashCard = {
        id: crypto.randomUUID(),
        deckId,
        front: values.front,
        back: values.back,
        tags: values.tags.length ? values.tags : undefined,
        example: values.example,
        dateAdded: now,
        nextReviewDate: now,
      };
      addCards([newCard]);
      toast({ title: t('flashcards.cardAdded') });
    } else if (editingCard) {
      updateCard(editingCard.id, {
        front: values.front,
        back: values.back,
        tags: values.tags.length ? values.tags : undefined,
        example: values.example,
      });
      toast({ title: t('flashcards.cardUpdated') });
    }
  };

  const handleBulkSubmit = (
    rows: ParsedTextRow[],
    options: { skipDuplicates: boolean },
  ) => {
    if (!rows.length) return;
    const now = new Date().toISOString();

    let acceptedRows: ParsedTextRow[] = rows;
    let skipped = 0;
    if (options.skipDuplicates) {
      const seen = new Set<string>(
        deckCards.map(c => cardDedupeKey(c.front, c.back)),
      );
      acceptedRows = [];
      for (const r of rows) {
        const key = cardDedupeKey(r.front, r.back);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        acceptedRows.push(r);
      }
    }

    const newCards: FlashCard[] = acceptedRows.map(r => ({
      id: crypto.randomUUID(),
      deckId,
      front: r.front,
      back: r.back,
      tags: r.tags && r.tags.length ? r.tags : undefined,
      example: r.example,
      dateAdded: now,
      nextReviewDate: now,
    }));
    if (newCards.length) addCards(newCards);
    toast({
      title:
        skipped > 0
          ? t('flashcards.bulkAddSuccessWithSkipped', {
              count: newCards.length,
              deck: deckName,
              skipped,
            })
          : t('flashcards.bulkAddSuccess', {
              count: newCards.length,
              deck: deckName,
            }),
    });
  };

  const handleCleanupTags = () => {
    const allCards = data.cards || [];
    const result = migrateTagsToExample(allCards, deckId);
    if (result.changedCount === 0) {
      toast({ title: t('flashcards.cleanupTagsNothing') });
      return;
    }
    replaceCards(result.cards);
    toast({
      title: t('flashcards.cleanupTagsRan', { count: result.changedCount }),
    });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    await deleteCard(confirmDeleteId);
    setConfirmDeleteId(null);
    toast({ title: t('flashcards.cardDeleted') });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('flashcards.manageCardsTitle')}</DialogTitle>
            <DialogDescription>{deckName}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {t('flashcards.cardsCount', { count: deckCards.length })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCleanupTags}
                title={t('flashcards.cleanupTagsTooltip')}
                aria-label={t('flashcards.cleanupTagsTooltip')}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {t('flashcards.cleanupTags')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                <ClipboardPaste className="w-4 h-4 mr-1.5" />
                {t('flashcards.bulkAdd')}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('flashcards.addCard')}
              </Button>
            </div>
          </div>

          {/* Status filter (segmented). Hidden when there are no suspended
              cards to keep the dialog tidy for the common case. */}
          {(suspendedCount > 0 || statusFilter !== 'all') && (
            <div
              role="tablist"
              aria-label={t('flashcards.statusFilterLabel')}
              className="inline-flex rounded-md border border-border bg-muted p-0.5 self-start"
            >
              {(['all', 'active', 'suspended'] as const).map(key => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-sm transition-colors min-h-[28px]',
                    statusFilter === key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {key === 'all' && t('flashcards.statusAll')}
                  {key === 'active' && t('flashcards.statusActive')}
                  {key === 'suspended' &&
                    `${t('flashcards.statusSuspended')}${
                      suspendedCount > 0 ? ` (${suspendedCount})` : ''
                    }`}
                </button>
              ))}
            </div>
          )}

          <div
            ref={scrollParentRef}
            className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6"
          >
            {deckCards.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('flashcards.noCards')}
              </div>
            ) : (
              <ul
                className="relative w-full py-1"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const card = deckCards[virtualRow.index];
                  if (!card) return null;
                  return (
                    <li
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full pb-2"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div
                        className={cn(
                          'border rounded-lg p-3 bg-card transition-all duration-300',
                          highlightId === card.id
                            ? 'border-primary ring-2 ring-primary/40 shadow-md'
                            : 'border-border',
                        )}
                      >
                        <div className={cn('flex items-start gap-2', isRTL && 'flex-row-reverse')}>
                          <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                            <div
                              className={cn(
                                'text-sm font-medium line-clamp-2 anki-card-content',
                                card.suspended && 'opacity-60',
                              )}
                              dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(card.front) }}
                            />
                            <div
                              className={cn(
                                'text-xs text-muted-foreground line-clamp-2 mt-1 anki-card-content',
                                card.suspended && 'opacity-60',
                              )}
                              dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(card.back) }}
                            />
                            {card.example && (
                              <div
                                className={cn(
                                  'text-[11px] text-muted-foreground/80 italic line-clamp-2 mt-1',
                                  card.suspended && 'opacity-60',
                                )}
                              >
                                {card.example}
                              </div>
                            )}
                            <div className={cn('flex flex-wrap gap-1 mt-1.5', isRTL && 'justify-end')}>
                              {card.suspended && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal border-warning/50 text-warning bg-warning/10"
                                >
                                  {t('flashcards.suspendedBadge')}
                                </Badge>
                              )}
                              {card.tags?.map(tag => (
                                <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(card)}
                              aria-label={t('flashcards.editCard')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleSuspend(card)}
                              aria-label={
                                card.suspended
                                  ? t('flashcards.unsuspendCard')
                                  : t('flashcards.suspendCard')
                              }
                              title={
                                card.suspended
                                  ? t('flashcards.unsuspendCard')
                                  : t('flashcards.suspendCard')
                              }
                            >
                              {card.suspended ? (
                                <Play className="w-3.5 h-3.5" />
                              ) : (
                                <Pause className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteId(card.id)}
                              aria-label={t('flashcards.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('flashcards.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        initialCard={editingCard}
        onSubmit={handleSubmit}
      />

      <BulkAddCardsDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        deckName={deckName}
        onSubmit={handleBulkSubmit}
      />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={open => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flashcards.confirmDeleteCard')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('flashcards.confirmDeleteCardDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('flashcards.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('flashcards.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
