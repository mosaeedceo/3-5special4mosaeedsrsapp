import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, ClipboardPaste } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { sanitizeCardHtml } from '@/lib/cardMedia';
import { Card as FlashCard } from '@/types/lesson';
import { CardEditorDialog } from './CardEditorDialog';
import { BulkAddCardsDialog } from './BulkAddCardsDialog';
import { cardDedupeKey, type ParsedTextRow } from '@/lib/cardTextParser';
import { cn } from '@/lib/utils';

interface CardManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
}

export const CardManagerDialog = ({
  open,
  onOpenChange,
  deckId,
  deckName,
}: CardManagerDialogProps) => {
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const { data, addCards, updateCard, deleteCard } = useLocalStorage();

  const [editingCard, setEditingCard] = useState<FlashCard | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const deckCards = useMemo(
    () => (data.cards || []).filter(c => c.deckId === deckId),
    [data.cards, deckId],
  );

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
    ttsLangFront?: string;
    ttsLangBack?: string;
  }) => {
    if (editorMode === 'create') {
      const now = new Date().toISOString();
      const newCard: FlashCard = {
        id: crypto.randomUUID(),
        deckId,
        front: values.front,
        back: values.back,
        tags: values.tags.length ? values.tags : undefined,
        ttsLangFront: values.ttsLangFront,
        ttsLangBack: values.ttsLangBack,
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
        ttsLangFront: values.ttsLangFront,
        ttsLangBack: values.ttsLangBack,
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
      ttsLangFront: r.langFront,
      ttsLangBack: r.langBack,
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

          <ScrollArea className="flex-1 -mx-6 px-6 max-h-[55vh]">
            {deckCards.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('flashcards.noCards')}
              </div>
            ) : (
              <ul className="space-y-2 py-1">
                {deckCards.map(card => (
                  <li
                    key={card.id}
                    className="border border-border rounded-lg p-3 bg-card"
                  >
                    <div className={cn('flex items-start gap-2', isRTL && 'flex-row-reverse')}>
                      <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                        <div
                          className="text-sm font-medium line-clamp-2 anki-card-content"
                          dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(card.front) }}
                        />
                        <div
                          className="text-xs text-muted-foreground line-clamp-2 mt-1 anki-card-content"
                          dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(card.back) }}
                        />
                        {card.tags && card.tags.length > 0 && (
                          <div className={cn('flex flex-wrap gap-1 mt-1.5', isRTL && 'justify-end')}>
                            {card.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
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
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(card.id)}
                          aria-label={t('flashcards.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

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
