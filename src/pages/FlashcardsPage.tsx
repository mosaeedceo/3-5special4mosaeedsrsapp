import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layers, Upload, Play, Pencil, Trash2, MoreVertical, FileText, Plus, ListChecks, ClipboardPaste, Volume2, BookOpen, Pause } from 'lucide-react';
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
import { DeckSettingsDialog, type CustomStudyAction } from '@/components/DeckSettingsDialog';
import { FloatingAddButton, type FabAction } from '@/components/FloatingAddButton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Deck } from '@/types/lesson';
import { cardDedupeKey, type ParsedTextRow } from '@/lib/cardTextParser';

export const FlashcardsPage = () => {
  const navigate = useNavigate();
  const { data, addDeck, deleteDeck, renameDeck, updateDeck, addCards, getDeckCards, getLessonsForDeck, updateSettings } =
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
  const [manageDeck, setManageDeck] = useState<{ id: string; name: string; focusCardId?: string; initialStatusFilter?: 'all' | 'active' | 'suspended' } | null>(null);
  const [suspendedPickerOpen, setSuspendedPickerOpen] = useState(false);
  const location = useLocation();
  const [bulkAddDeck, setBulkAddDeck] = useState<{ id: string; name: string } | null>(null);
  const [settingsDeck, setSettingsDeck] = useState<Deck | null>(null);
  const [pickDeckMode, setPickDeckMode] = useState<'add' | 'bulk' | null>(null);

  const decks = data.decks || [];

  // Open the card manager pre-targeted at a specific deck/card when arriving
  // here via the leech-suspended toast in DeckReviewPage.
  useEffect(() => {
    const state = location.state as
      | { openManagerDeckId?: string; focusCardId?: string }
      | null;
    if (!state?.openManagerDeckId) return;
    const deck = (data.decks || []).find(d => d.id === state.openManagerDeckId);
    if (!deck) return;
    setManageDeck({ id: deck.id, name: deck.name, focusCardId: state.focusCardId });
    // Clear the navigation state so this only fires once.
    navigate(location.pathname, { replace: true });
  }, [location.state, location.pathname, data.decks, navigate]);

  const stats = useMemo(() => {
    const map = new Map<string, { total: number; due: number; isNew: number; suspended: number }>();
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
      const suspended = cards.filter(c => !!c.suspended).length;
      map.set(d.id, { total: cards.length, due, isNew, suspended });
    }
    return map;
  }, [decks, getDeckCards]);

  const suspendedSummary = useMemo(() => {
    let total = 0;
    const decksWithSuspended: { id: string; name: string; count: number }[] = [];
    for (const d of decks) {
      const s = stats.get(d.id);
      if (s && s.suspended > 0) {
        total += s.suspended;
        decksWithSuspended.push({ id: d.id, name: d.name, count: s.suspended });
      }
    }
    return { total, decks: decksWithSuspended };
  }, [decks, stats]);

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
    example?: string;
    ttsLangExample?: string;
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
      example: values.example,
      ttsLangExample: values.ttsLangExample,
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
      example: r.example,
      ttsLangExample: r.langExample,
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
          <>
          {suspendedSummary.total > 0 && (
            <Popover open={suspendedPickerOpen} onOpenChange={setSuspendedPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full mb-3 rounded-lg border border-warning/30 bg-warning/10 hover:bg-warning/15 transition-colors p-3 flex items-center gap-3',
                    isRTL && 'flex-row-reverse text-right',
                  )}
                  aria-label={t('flashcards.suspendedSummaryTitle')}
                >
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
                    <Pause className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-warning">
                      {t('flashcards.suspendedSummaryTitle')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('flashcards.suspendedSummaryDesc', {
                        count: suspendedSummary.total,
                        decks: suspendedSummary.decks.length,
                      })}
                    </div>
                  </div>
                  <Badge className="text-[11px] font-semibold bg-warning text-warning-foreground border-transparent">
                    {suspendedSummary.total}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align={isRTL ? 'end' : 'start'}
                dir={isRTL ? 'rtl' : 'ltr'}
                className="w-72 p-1"
              >
                <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('flashcards.suspendedPickDeckTitle')}
                </div>
                <div className="flex flex-col max-h-72 overflow-auto">
                  {suspendedSummary.decks.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSuspendedPickerOpen(false);
                        setManageDeck({
                          id: d.id,
                          name: d.name,
                          initialStatusFilter: 'suspended',
                        });
                      }}
                      className={cn(
                        'flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-accent/40 text-left',
                        isRTL && 'text-right flex-row-reverse',
                      )}
                    >
                      <Layers className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{d.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal border-warning/40 text-warning bg-warning/10"
                      >
                        {d.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
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
                        {s.suspended > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setManageDeck({
                                id: deck.id,
                                name: deck.name,
                                initialStatusFilter: 'suspended',
                              })
                            }
                            aria-label={t('flashcards.suspendedCount', { count: s.suspended })}
                            className="inline-flex items-center"
                          >
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 transition-colors cursor-pointer"
                            >
                              {t('flashcards.suspendedCount', { count: s.suspended })}
                            </Badge>
                          </button>
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

                  {(() => {
                    const linkedLessons = getLessonsForDeck(deck.id);
                    if (linkedLessons.length === 0) return null;
                    if (linkedLessons.length === 1) {
                      const ll = linkedLessons[0];
                      return (
                        <button
                          type="button"
                          onClick={() => navigate('/library', { state: { scrollToLessonId: ll.id } })}
                          className="mb-2 inline-flex items-center gap-1 self-start text-[10px] h-5 px-1.5 rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors max-w-full"
                          aria-label={t('flashcards.openLesson')}
                        >
                          <BookOpen className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{ll.title}</span>
                        </button>
                      );
                    }
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="mb-2 inline-flex items-center gap-1 self-start text-[10px] h-5 px-1.5 rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                          >
                            <BookOpen className="w-2.5 h-2.5" />
                            <span>{t('flashcards.openLessonsCount', { count: linkedLessons.length })}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          dir={isRTL ? 'rtl' : 'ltr'}
                          className="w-56 p-1"
                        >
                          <div className="flex flex-col max-h-64 overflow-auto">
                            {linkedLessons.map(ll => (
                              <button
                                key={ll.id}
                                type="button"
                                onClick={() => navigate('/library', { state: { scrollToLessonId: ll.id } })}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent/30 text-left",
                                  isRTL && "text-right flex-row-reverse",
                                )}
                              >
                                <BookOpen className="w-3 h-3 shrink-0 text-accent" />
                                <span className="truncate">{ll.title}</span>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })()}

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
          </>
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
          focusCardId={manageDeck.focusCardId}
          initialStatusFilter={manageDeck.initialStatusFilter}
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

      {/* Deck settings (TTS, daily limits, FSRS, easy days, custom study) */}
      <DeckSettingsDialog
        open={!!settingsDeck}
        onOpenChange={open => !open && setSettingsDeck(null)}
        deck={settingsDeck}
        onSave={updates => {
          if (settingsDeck) updateDeck(settingsDeck.id, updates);
        }}
        onLaunchCustomStudy={action => {
          if (!settingsDeck) return;
          const deckId = settingsDeck.id;
          // "Today only" bumps are persisted on the deck so the regular due
          // queue widens for the rest of the local day. Other actions launch
          // a one-off scoped review session via navigation state.
          if (action.type === 'extraNew' || action.type === 'extraReviews') {
            const todayKey = (() => {
              const d = new Date();
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            })();
            const existing =
              settingsDeck.todayBumps && settingsDeck.todayBumps.date === todayKey
                ? settingsDeck.todayBumps
                : { date: todayKey };
            const merged = { ...existing };
            if (action.type === 'extraNew') {
              merged.extraNew = (existing.extraNew || 0) + action.count;
            } else {
              merged.extraReviews = (existing.extraReviews || 0) + action.count;
            }
            updateDeck(deckId, { todayBumps: merged });
            navigate(`/flashcards/${deckId}/review`);
            return;
          }
          navigate(`/flashcards/${deckId}/review`, {
            state: { customStudy: action satisfies CustomStudyAction },
          });
        }}
      />

      {/* Floating Add Button: Add card / Bulk add / New deck — always visible */}
      {(() => {
        const lastReviewedId = data.settings.lastReviewedDeckId;
        const lastReviewedDeck = lastReviewedId ? decks.find(d => d.id === lastReviewedId) : undefined;
        // Resolved target: explicit last-reviewed wins; otherwise undefined when multiple decks (forces picker).
        const targetDeck =
          lastReviewedDeck ||
          (decks.length === 1 ? decks[0] : undefined);
        const needsPicker = decks.length > 1 && !targetDeck;

        const baseActions: FabAction[] = [];
        if (decks.length > 0) {
          baseActions.push({
            key: 'add-card',
            label: targetDeck
              ? t('flashcards.fabAddCardTo', { deck: targetDeck.name })
              : t('flashcards.fabAddCard'),
            icon: <Plus className="w-4 h-4" />,
            onSelect: () => {
              if (targetDeck) setAddCardTargetDeckId(targetDeck.id);
              else if (needsPicker) setPickDeckMode('add');
            },
          });
          baseActions.push({
            key: 'bulk-add',
            label: t('flashcards.fabBulkAdd'),
            icon: <ClipboardPaste className="w-4 h-4" />,
            onSelect: () => {
              if (targetDeck) setBulkAddDeck({ id: targetDeck.id, name: targetDeck.name });
              else if (needsPicker) setPickDeckMode('bulk');
            },
          });
        }
        baseActions.push({
          key: 'new-deck',
          label: t('flashcards.fabNewDeck'),
          icon: <Layers className="w-4 h-4" />,
          onSelect: () => setCreateDeckOpen(true),
        });

        return (
          <FloatingAddButton
            categories={[]}
            position={data.settings.fabPosition || 'right'}
            coordinates={data.settings.fabCoordinates}
            onPositionChange={(pos, coords) => updateSettings({ fabPosition: pos, fabCoordinates: coords })}
            actions={baseActions}
          />
        );
      })()}

      {/* Deck picker for FAB Add card / Bulk add when no last-reviewed deck */}
      <AlertDialog open={!!pickDeckMode} onOpenChange={open => !open && setPickDeckMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pickDeckMode === 'bulk' ? t('flashcards.fabBulkAdd') : t('flashcards.fabAddCard')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('flashcards.pickDeckPrompt')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2 space-y-1">
            {decks.map(d => (
              <button
                key={d.id}
                type="button"
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/40 hover:border-primary/40 transition-colors"
                onClick={() => {
                  if (pickDeckMode === 'bulk') setBulkAddDeck({ id: d.id, name: d.name });
                  else setAddCardTargetDeckId(d.id);
                  setPickDeckMode(null);
                }}
              >
                <div className="text-sm font-medium text-foreground truncate">{d.name}</div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('flashcards.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
