import { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Upload, Play, Pencil, Trash2, MoreVertical, FileText, Plus, ListChecks, ClipboardPaste, Volume2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { parseImportFile, persistMedia } from '@/lib/ankiParser';
import { Card as FlashCard, CardMedia } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { CardEditorDialog } from '@/components/CardEditorDialog';
import { CardManagerDialog } from '@/components/CardManagerDialog';
import { BulkAddCardsDialog } from '@/components/BulkAddCardsDialog';
import { DeckSettingsDialog } from '@/components/DeckSettingsDialog';
import type { Deck } from '@/types/lesson';
import { cardDedupeKey, type ParsedTextRow } from '@/lib/cardTextParser';

export const FlashcardsPage = () => {
  const navigate = useNavigate();
  const { data, addDeck, deleteDeck, renameDeck, updateDeck, addCards, getDeckCards } =
    useLocalStorage();
  const { containerClass, isTabletMode } = useDisplayMode(data.settings.displayMode);
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [createDeckOpen, setCreateDeckOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [addCardTargetDeckId, setAddCardTargetDeckId] = useState<string | null>(null);
  const [manageDeck, setManageDeck] = useState<{ id: string; name: string } | null>(null);
  const [bulkAddDeck, setBulkAddDeck] = useState<{ id: string; name: string } | null>(null);
  const [settingsDeck, setSettingsDeck] = useState<Deck | null>(null);

  const decks = data.decks || [];

  const stats = useMemo(() => {
    const map = new Map<string, { total: number; due: number; isNew: number }>();
    const now = new Date();
    for (const d of decks) {
      const cards = getDeckCards(d.id);
      // "Due" = scheduled cards whose nextReviewDate has passed (excludes new).
      const due = cards.filter(
        c =>
          !c.suspended &&
          c.fsrs &&
          c.fsrs.state !== 'new' &&
          new Date(c.nextReviewDate) <= now,
      ).length;
      const isNew = cards.filter(c => !c.fsrs || c.fsrs.state === 'new').length;
      map.set(d.id, { total: cards.length, due, isNew });
    }
    return map;
  }, [decks, getDeckCards]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset for re-selection of same file
    setImporting(true);
    try {
      const results = await parseImportFile(file);
      const isAnki = file.name.toLowerCase().endsWith('.apkg')
        || file.name.toLowerCase().endsWith('.colpkg');

      const buildCardWithMedia = (
        c: Omit<FlashCard, 'deckId'>,
        deckId: string,
        mediaMap: Map<string, CardMedia>,
      ): FlashCard => {
        const usedNames = new Set<string>();
        const findRefs = (text: string) => {
          const imgRe = /<img[^>]*src\s*=\s*["']([^"']+)["']/gi;
          const soundRe = /\[sound:([^\]]+)\]/gi;
          let m: RegExpExecArray | null;
          while ((m = imgRe.exec(text))) usedNames.add(m[1]);
          while ((m = soundRe.exec(text))) usedNames.add(m[1]);
        };
        findRefs(c.front);
        findRefs(c.back);

        const attached: CardMedia[] = [];
        for (const name of usedNames) {
          const cm = mediaMap.get(name);
          if (cm) attached.push(cm);
        }

        return {
          ...c,
          deckId,
          media: attached.length ? attached : undefined,
        };
      };

      const summaryLines: string[] = [];
      let totalCards = 0;
      let totalMedia = 0;

      for (const result of results) {
        const mediaMap = await persistMedia(result.media);
        const newDeck = addDeck({
          name: result.deckName,
          source: isAnki ? 'anki' : 'csv',
        });
        const cardsWithDeck = result.cards.map(c => buildCardWithMedia(c, newDeck.id, mediaMap));
        addCards(cardsWithDeck);

        totalCards += cardsWithDeck.length;
        totalMedia += result.media.length;
        summaryLines.push(
          t('flashcards.importDeckLine', {
            deck: result.deckName,
            cards: cardsWithDeck.length,
            media: result.media.length,
          }),
        );
      }

      const title =
        results.length === 1
          ? t('flashcards.importSuccess', {
              count: totalCards,
              deck: results[0].deckName,
            })
          : t('flashcards.importSuccessMulti', {
              decks: results.length,
              cards: totalCards,
              media: totalMedia,
            });

      toast({
        title,
        description:
          results.length > 1 || totalMedia > 0
            ? summaryLines.join('\n')
            : undefined,
      });
    } catch (err: any) {
      console.error('[FlashcardsPage] import error', err);
      toast({
        title: t('flashcards.importFailed'),
        description: err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteDeck(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    const newName = renameTarget.name.trim();
    if (!newName) return;
    renameDeck(renameTarget.id, newName);
    setRenameTarget(null);
  };

  const handleCreateDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    const created = addDeck({ name, source: 'manual' });
    setCreateDeckOpen(false);
    setNewDeckName('');
    setAddCardTargetDeckId(created.id);
  };

  const handleAddCardSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    ttsLangFront?: string;
    ttsLangBack?: string;
  }) => {
    if (!addCardTargetDeckId) return;
    const now = new Date().toISOString();
    const card: FlashCard = {
      id: crypto.randomUUID(),
      deckId: addCardTargetDeckId,
      front: values.front,
      back: values.back,
      tags: values.tags.length ? values.tags : undefined,
      ttsLangFront: values.ttsLangFront,
      ttsLangBack: values.ttsLangBack,
      dateAdded: now,
      nextReviewDate: now,
    };
    addCards([card]);
    toast({ title: t('flashcards.cardAdded') });
  };

  const handleBulkAddSubmit = (
    rows: ParsedTextRow[],
    options: { skipDuplicates: boolean },
  ) => {
    if (!bulkAddDeck || rows.length === 0) return;
    const now = new Date().toISOString();

    let acceptedRows: ParsedTextRow[] = rows;
    let skipped = 0;
    if (options.skipDuplicates) {
      const existing = (data.cards || []).filter(c => c.deckId === bulkAddDeck.id);
      const seen = new Set<string>(
        existing.map(c => cardDedupeKey(c.front, c.back)),
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

    const cards: FlashCard[] = acceptedRows.map(r => ({
      id: crypto.randomUUID(),
      deckId: bulkAddDeck.id,
      front: r.front,
      back: r.back,
      tags: r.tags && r.tags.length ? r.tags : undefined,
      ttsLangFront: r.langFront,
      ttsLangBack: r.langBack,
      dateAdded: now,
      nextReviewDate: now,
    }));
    if (cards.length) addCards(cards);
    toast({
      title:
        skipped > 0
          ? t('flashcards.bulkAddSuccessWithSkipped', {
              count: cards.length,
              deck: bulkAddDeck.name,
              skipped,
            })
          : t('flashcards.bulkAddSuccess', {
              count: cards.length,
              deck: bulkAddDeck.name,
            }),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className={cn(containerClass, 'mx-auto px-4 py-4 flex items-center justify-between gap-3')}>
          <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h1 className="font-heading text-lg font-bold leading-tight">
                {t('flashcards.title')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t('flashcards.subtitle')}
              </p>
            </div>
          </div>
          <div className={cn('flex items-center gap-2 shrink-0', isRTL && 'flex-row-reverse')}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setNewDeckName(''); setCreateDeckOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t('flashcards.newDeck')}
            </Button>
            <Button
              size="sm"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {importing ? t('flashcards.importing') : t('flashcards.importDeck')}
            </Button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".apkg,.colpkg,.csv,.tsv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <main className={cn(containerClass, 'mx-auto px-4 py-5')}>
        {decks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{t('flashcards.noDecks')}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {t('flashcards.noDecksDesc')}
                </p>
              </div>
              <Button onClick={handleImportClick} disabled={importing}>
                <Upload className="w-4 h-4 mr-2" />
                {importing ? t('flashcards.importing') : t('flashcards.importDeck')}
              </Button>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-2 leading-relaxed">
                {t('flashcards.legacyOnlyHint')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={cn(isTabletMode ? 'grid grid-cols-2 gap-3' : 'space-y-3')}>
          {decks.map(deck => {
            const s = stats.get(deck.id) || { total: 0, due: 0, isNew: 0 };
            return (
              <Card key={deck.id} className="overflow-hidden h-full flex flex-col">
                <CardContent className="p-4 flex-1 flex flex-col">
                  <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                      <h3 className="font-semibold truncate">{deck.name}</h3>
                      <div className={cn('flex flex-wrap items-center gap-1.5 mt-1', isRTL && 'justify-end')}>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {t('flashcards.cardsCount', { count: s.total })}
                        </Badge>
                        {s.due > 0 && (
                          <Badge className="text-[10px] font-normal bg-warning/15 text-warning border-warning/30">
                            {t('flashcards.dueCount', { count: s.due })}
                          </Badge>
                        )}
                        {s.isNew > 0 && (
                          <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">
                            {t('flashcards.newCount', { count: s.isNew })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={t('a11y.deckMenu')}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => setAddCardTargetDeckId(deck.id)}>
                          <Plus className="w-4 h-4 mr-2" />
                          {t('flashcards.addCard')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkAddDeck({ id: deck.id, name: deck.name })}>
                          <ClipboardPaste className="w-4 h-4 mr-2" />
                          {t('flashcards.bulkAdd')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setManageDeck({ id: deck.id, name: deck.name })}>
                          <ListChecks className="w-4 h-4 mr-2" />
                          {t('flashcards.manageCards')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSettingsDeck(deck)}>
                          <Volume2 className="w-4 h-4 mr-2" />
                          {t('tts.deckSettings')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenameTarget({ id: deck.id, name: deck.name })}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t('flashcards.rename')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmDeleteId(deck.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('flashcards.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button
                    className="w-full mt-auto pt-0 h-9"
                    variant={s.due > 0 || s.isNew > 0 ? 'default' : 'outline'}
                    disabled={s.total === 0}
                    onClick={() => navigate(`/flashcards/${deck.id}/review`)}
                    aria-label={t('a11y.startReview')}
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    {t('flashcards.review')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flashcards.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('flashcards.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('flashcards.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('flashcards.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('flashcards.rename')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deck-name">{t('flashcards.deckNameLabel')}</Label>
            <Input
              id="deck-name"
              value={renameTarget?.name || ''}
              onChange={e => setRenameTarget(p => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              {t('flashcards.cancel')}
            </Button>
            <Button onClick={handleRenameSubmit}>{t('flashcards.rename')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create empty deck */}
      <Dialog open={createDeckOpen} onOpenChange={setCreateDeckOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('flashcards.addNewDeckTitle')}</DialogTitle>
            <DialogDescription>{t('flashcards.newDeckDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-deck-name">{t('flashcards.deckNameLabel')}</Label>
            <Input
              id="new-deck-name"
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDeckOpen(false)}>
              {t('flashcards.cancel')}
            </Button>
            <Button onClick={handleCreateDeck} disabled={!newDeckName.trim()}>
              {t('flashcards.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add card dialog */}
      <CardEditorDialog
        open={!!addCardTargetDeckId}
        onOpenChange={open => !open && setAddCardTargetDeckId(null)}
        mode="create"
        onSubmit={handleAddCardSubmit}
      />

      {/* Manage cards */}
      {manageDeck && (
        <CardManagerDialog
          open={!!manageDeck}
          onOpenChange={open => !open && setManageDeck(null)}
          deckId={manageDeck.id}
          deckName={manageDeck.name}
        />
      )}

      {/* Bulk add cards */}
      {bulkAddDeck && (
        <BulkAddCardsDialog
          open={!!bulkAddDeck}
          onOpenChange={open => !open && setBulkAddDeck(null)}
          deckName={bulkAddDeck.name}
          onSubmit={handleBulkAddSubmit}
        />
      )}

      {/* Deck settings (TTS, etc.) */}
      <DeckSettingsDialog
        open={!!settingsDeck}
        onOpenChange={open => !open && setSettingsDeck(null)}
        deck={settingsDeck}
        onSave={updates => {
          if (settingsDeck) updateDeck(settingsDeck.id, updates);
        }}
      />
    </div>
  );
};
