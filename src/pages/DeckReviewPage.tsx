import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Volume2, RotateCcw, Brain, Zap, Plus, Pencil, Trash2, MoreVertical, BookOpen } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { resolveCardMedia, sanitizeCardHtml } from '@/lib/cardMedia';
import { getCardReviewOptions } from '@/lib/cardFsrs';
import { FSRSRating, Card as FlashCard } from '@/types/lesson';
import { looksLikeLanguageDeck } from '@/lib/languageDeckDetect';
import { cn } from '@/lib/utils';
import { CardEditorDialog } from '@/components/CardEditorDialog';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const RATING_CONFIG: Record<FSRSRating, { Icon: typeof RotateCcw; className: string; labelKey: string }> = {
  again: { Icon: RotateCcw, className: 'bg-danger/10 hover:bg-danger/20 text-danger border-danger/30', labelKey: 'ratings.again' },
  hard: { Icon: Brain, className: 'bg-warning/10 hover:bg-warning/20 text-warning border-warning/30', labelKey: 'ratings.hard' },
  good: { Icon: Zap, className: 'bg-success/10 hover:bg-success/20 text-success border-success/30', labelKey: 'ratings.good' },
  easy: { Icon: Sparkles, className: 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30', labelKey: 'ratings.easy' },
};

export const DeckReviewPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const jumpToCardId = (location.state as { jumpToCardId?: string } | null)?.jumpToCardId;
  const jumpedRef = useRef(false);
  const { data, getDueCards, getCustomStudyCards, reviewCard, addCards, updateCard, deleteCard, updateSettings } = useLocalStorage();
  const customStudy = (location.state as { customStudy?: import('@/components/DeckSettingsDialog').CustomStudyAction } | null)?.customStudy;
  const { containerClass } = useDisplayMode(data.settings.displayMode);
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // IDs auto-suspended as leeches during this review session. When the
  // "Quiet leech notifications" setting is on, we skip the per-card toast
  // and instead surface them in the session-done summary.
  const [sessionLeeches, setSessionLeeches] = useState<string[]>([]);
  // Briefly-shown inline cue above the rating buttons when a leech is
  // suspended in quiet mode — non-interruptive replacement for the toast.
  const [leechHint, setLeechHint] = useState(false);
  const leechHintTimerRef = useRef<number | null>(null);

  const deck = (data.decks || []).find(d => d.id === deckId);

  // Remember last reviewed deck so the Flashcards FAB's "Add card" can target it.
  // Re-runs once `deck` resolves to handle async hydration of localStorage data.
  useEffect(() => {
    if (deckId && deck) {
      updateSettings({ lastReviewedDeckId: deckId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, !!deck]);
  // Snapshot due-card IDs once per session so the queue doesn't shrink mid-session.
  // When invoked with a Custom Study filter, build the queue from that scope
  // instead of the regular due-card list.
  const [queue, setQueue] = useState<string[]>(() => {
    if (!deckId) return [];
    if (customStudy && customStudy.type !== 'extraNew' && customStudy.type !== 'extraReviews') {
      return getCustomStudyCards(deckId, customStudy).map(c => c.id);
    }
    return getDueCards(deckId).map(c => c.id);
  });
  const [position, setPosition] = useState(0);
  const initialTotal = useRef(queue.length);

  // Jump to a specific card if requested via navigation state (from card-search hits).
  useEffect(() => {
    if (jumpedRef.current || !jumpToCardId || queue.length === 0) return;
    const idx = queue.indexOf(jumpToCardId);
    if (idx >= 0) {
      setPosition(idx);
      jumpedRef.current = true;
    }
  }, [jumpToCardId, queue]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [resolved, setResolved] = useState<{ front: string; back: string; audioFront: string[]; audioBack: string[] } | null>(null);

  const allCards = data.cards || [];
  const currentCard: FlashCard | undefined = useMemo(() => {
    const id = queue[position];
    return id ? allCards.find(c => c.id === id) : undefined;
  }, [queue, position, allCards]);

  // Compute review-time interval previews from the live card state.
  // Per-deck retention overrides take precedence over the global setting.
  const effectiveRetention =
    deck?.desiredRetentionOverride ?? data.settings.desiredRetention ?? 0.9;
  const reviewOptions = useMemo(() => {
    if (!currentCard) return null;
    return getCardReviewOptions(currentCard, effectiveRetention);
  }, [currentCard, effectiveRetention]);

  // Resolve media (replace <img src="file"> + extract [sound:])
  useEffect(() => {
    let cancelled = false;
    if (!currentCard) {
      setResolved(null);
      return;
    }
    resolveCardMedia(currentCard).then(r => {
      if (!cancelled) setResolved(r);
    });
    return () => { cancelled = true; };
  }, [currentCard]);

  // Reset reveal state when moving to next card.
  useEffect(() => {
    setShowAnswer(false);
  }, [position]);

  // Clear any pending leech-hint timer on unmount to avoid setState on
  // unmounted component warnings if the user leaves mid-fade.
  useEffect(() => {
    return () => {
      if (leechHintTimerRef.current !== null) {
        window.clearTimeout(leechHintTimerRef.current);
        leechHintTimerRef.current = null;
      }
    };
  }, []);

  // True when the deck looks like a vocabulary / language-learning deck.
  // Language decks get a dedicated stacked-paper layout matching the design —
  // this lets imported Anki vocab decks pick it up automatically.
  const deckCards = useMemo(
    () => (deckId ? allCards.filter(c => c.deckId === deckId) : []),
    [allCards, deckId],
  );
  const isLangDeck = useMemo(
    () => looksLikeLanguageDeck(deck, deckCards),
    [deck, deckCards],
  );

  if (!deck) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-6">
        <p className="text-muted-foreground mb-4">{t('flashcards.deckNotFound')}</p>
        <Button onClick={() => navigate('/flashcards')}>
          <BackIcon className="w-4 h-4 mr-2" />
          {t('flashcards.backToDecks')}
        </Button>
      </div>
    );
  }

  const totalDone = position;
  const total = initialTotal.current;
  const progressPct = total > 0 ? Math.round((totalDone / total) * 100) : 0;

  const handleRate = (rating: FSRSRating) => {
    if (!currentCard) return;
    const result = reviewCard(currentCard.id, rating);
    if (result?.leechSuspended && deckId) {
      const suspendedId = currentCard.id;
      setSessionLeeches(prev =>
        prev.includes(suspendedId) ? prev : [...prev, suspendedId],
      );
      if (data.settings.quietLeechNotifications) {
        // Quiet mode: show a brief, non-interruptive inline hint above the
        // rating buttons that fades after a few seconds. The full list is
        // surfaced on the session-done card.
        setLeechHint(true);
        if (leechHintTimerRef.current !== null) {
          window.clearTimeout(leechHintTimerRef.current);
        }
        leechHintTimerRef.current = window.setTimeout(() => {
          setLeechHint(false);
          leechHintTimerRef.current = null;
        }, 2500);
      } else {
        toast({
          title: t('flashcards.leechToast'),
          description: t('flashcards.leechToastDesc'),
          action: (
            <ToastAction
              altText={t('flashcards.leechToastAction')}
              onClick={() =>
                navigate(`/flashcards`, {
                  state: { openManagerDeckId: deckId, focusCardId: suspendedId },
                })
              }
            >
              {t('flashcards.leechToastAction')}
            </ToastAction>
          ),
        });
      }
    }
    setPosition(p => p + 1);
  };

  const sessionDone = !currentCard;

  const handleExit = () => {
    const midSession =
      queue.length > 0 && position > 0 && position < queue.length;
    if (midSession) {
      setExitConfirmOpen(true);
    } else {
      navigate('/flashcards');
    }
  };

  // Keyboard shortcuts: Space (flip), 1-4 (rate when answer shown),
  // R (replay current side), Esc (exit). Disabled while any dialog is open
  // or focus is in an editable element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        addCardOpen ||
        editCardOpen ||
        confirmDeleteOpen ||
        exitConfirmOpen
      ) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) return;
        // Don't hijack keyboard activation for focused interactive controls
        // (e.g. Space on a focused Button should trigger that button, not flip
        // the card). Rating digits (1-4) don't conflict with native button
        // activation, so we only bail for keys that DO collide.
        const isInteractive =
          tag === 'BUTTON' ||
          tag === 'A' ||
          target.getAttribute('role') === 'button' ||
          target.getAttribute('role') === 'menuitem';
        if (
          isInteractive &&
          (e.key === ' ' || e.code === 'Space' || e.key === 'Enter')
        ) return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
        return;
      }
      if (sessionDone || !currentCard) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer) setShowAnswer(true);
        return;
      }
      if (showAnswer) {
        const ratingMap: Record<string, FSRSRating> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        };
        const r = ratingMap[e.key];
        if (r) {
          e.preventDefault();
          handleRate(r);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleRate / handleExit close over the latest state via the listed deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    addCardOpen,
    editCardOpen,
    confirmDeleteOpen,
    exitConfirmOpen,
    sessionDone,
    showAnswer,
    currentCard,
    queue.length,
    position,
  ]);

  const handleAddCardSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    example?: string;
  }) => {
    if (!deckId) return;
    const now = new Date().toISOString();
    const card: FlashCard = {
      id: crypto.randomUUID(),
      deckId,
      front: values.front,
      back: values.back,
      tags: values.tags.length ? values.tags : undefined,
      example: values.example,
      dateAdded: now,
      nextReviewDate: now,
    };
    addCards([card]);
    toast({ title: t('flashcards.cardAdded') });
  };

  const handleEditCardSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    example?: string;
  }) => {
    if (!currentCard) return;
    updateCard(currentCard.id, {
      front: values.front,
      back: values.back,
      tags: values.tags.length ? values.tags : undefined,
      example: values.example,
    });
    toast({ title: t('flashcards.cardUpdated') });
  };

  const handleDeleteCurrent = async () => {
    if (!currentCard) return;
    const idToDelete = currentCard.id;
    setConfirmDeleteOpen(false);
    await deleteCard(idToDelete);
    setQueue(q => q.filter(id => id !== idToDelete));
    toast({ title: t('flashcards.cardDeleted') });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className={cn(containerClass, 'mx-auto px-4 py-3')}>
          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExit}
              className="h-9 w-9 shrink-0"
              aria-label={t('review.exit')}
            >
              <BackIcon className="w-5 h-5" />
            </Button>
            <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
              <h1 className="font-heading text-base font-bold truncate">{deck.name}</h1>
              {!sessionDone && total > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t('flashcards.progressLabel', { current: position + 1, total })}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAddCardOpen(true)}
              className="h-9 w-9 shrink-0"
              aria-label={t('flashcards.addCard')}
            >
              <Plus className="w-5 h-5" />
            </Button>
            {currentCard && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label={t('a11y.cardMenu')}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                  <DropdownMenuItem onClick={() => setEditCardOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    {t('flashcards.editCard')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('flashcards.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!sessionDone && total > 0 && (
            <Progress value={progressPct} className="h-1 mt-2" />
          )}
        </div>
      </header>

      <main className={cn(containerClass, 'mx-auto px-4 py-6')}>
        {sessionDone ? (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold">{t('flashcards.sessionDone')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('flashcards.sessionDoneDesc')}
              </p>
            </div>
            {sessionLeeches.length > 0 && data.settings.quietLeechNotifications && (
              <div className="w-full max-w-sm rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                <p>
                  {t('flashcards.leechSessionSummary', {
                    count: sessionLeeches.length,
                  })}
                </p>
                <Button
                  variant="link"
                  className="h-auto p-0 mt-1 text-warning underline"
                  onClick={() =>
                    navigate('/flashcards', {
                      state: {
                        openManagerDeckId: deckId,
                        focusCardId: sessionLeeches[0],
                      },
                    })
                  }
                >
                  {t('flashcards.leechSessionSummaryLink')}
                </Button>
              </div>
            )}
            <Button onClick={() => navigate('/flashcards')}>
              {t('flashcards.backToDecks')}
            </Button>
          </div>
        ) : !resolved ? (
          <Card>
            <CardContent className="p-6 min-h-[200px] flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">…</div>
            </CardContent>
          </Card>
        ) : (
          <>
            {isLangDeck ? (
              <LanguageDeckCard
                front={resolved.front}
                back={resolved.back}
                example={currentCard?.example}
                showAnswer={showAnswer}
                onEdit={() => setEditCardOpen(true)}
                editLabel={t('flashcards.editCard')}
                audioFront={resolved.audioFront}
                audioBack={resolved.audioBack}
              />
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-[10px]">
                      {t('flashcards.front')}
                    </Badge>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none anki-card-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(resolved.front) }}
                  />
                  {resolved.audioFront.map((url, i) => (
                    <AudioPlayer key={`af-${i}`} url={url} autoPlay />
                  ))}

                  {showAnswer && (
                    <>
                      <div className="my-4 border-t border-dashed" />
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                          {t('flashcards.back')}
                        </Badge>
                      </div>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none anki-card-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(resolved.back) }}
                      />
                      {resolved.audioBack.map((url, i) => (
                        <AudioPlayer key={`ab-${i}`} url={url} />
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {leechHint && (
              <div
                className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning text-center animate-fade-in"
                role="status"
                aria-live="polite"
              >
                {t('flashcards.leechToast')}
              </div>
            )}

            <div className="mt-6">
              {!showAnswer ? (
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => setShowAnswer(true)}
                >
                  {t('flashcards.showAnswer')}
                </Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {(['again', 'hard', 'good', 'easy'] as FSRSRating[]).map(rating => {
                    const cfg = RATING_CONFIG[rating];
                    const Icon = cfg.Icon;
                    const opt = reviewOptions?.[rating];
                    return (
                      <Button
                        key={rating}
                        variant="outline"
                        className={cn(
                          'flex flex-col items-center gap-1 h-auto py-3 px-1 border-2',
                          cfg.className,
                        )}
                        onClick={() => handleRate(rating)}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-semibold text-xs">{t(cfg.labelKey)}</span>
                        {opt && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                            {opt.label}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            <p
              className="hidden md:block text-center text-[11px] text-muted-foreground mt-3"
              aria-hidden="true"
            >
              {t('review.shortcutsHint')}
            </p>
          </>
        )}
      </main>

      <CardEditorDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        mode="create"
        onSubmit={handleAddCardSubmit}
      />

      <CardEditorDialog
        open={editCardOpen}
        onOpenChange={setEditCardOpen}
        mode="edit"
        initialCard={currentCard}
        onSubmit={handleEditCardSubmit}
      />

      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('review.exitConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('review.exitConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('review.stay')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExitConfirmOpen(false);
                navigate('/flashcards');
              }}
            >
              {t('review.exitConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
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
              onClick={handleDeleteCurrent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('flashcards.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Language-deck card (matches the "stacked-paper" mockup design)
// ---------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip HTML tags so we can match the front word inside the example as plain text. */
const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

/**
 * Highlight every occurrence of the front word(s) inside the example sentence.
 * Renders the rest of the sentence as plain (escaped) text and the matched
 * substring(s) as bold + amber, mirroring the design mockup.
 */
const highlightExample = (example: string, front: string): string => {
  const word = stripHtml(front);
  const safe = escapeHtml(example);
  if (!word) return safe;
  // Unicode-aware word boundaries: don't match inside larger words.
  // Uses lookarounds against any letter/number in any script so that
  // non-Latin languages (Arabic, Chinese, etc.) are handled correctly.
  let re: RegExp;
  try {
    re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(escapeHtml(word))}(?![\\p{L}\\p{N}])`,
      'giu',
    );
  } catch {
    // Fallback for engines without Unicode property escapes.
    re = new RegExp(`\\b${escapeRegExp(escapeHtml(word))}\\b`, 'gi');
  }
  if (!re.test(safe)) return safe;
  re.lastIndex = 0;
  return safe.replace(
    re,
    m => `<strong class="font-semibold text-amber-600 dark:text-amber-500">${m}</strong>`,
  );
};

/**
 * Render the front word with its first token coloured (e.g. the article
 * "die" in pink) and the remainder in the default colour.
 */
const renderHeadword = (front: string) => {
  const txt = stripHtml(front);
  const idx = txt.search(/\s/);
  if (idx <= 0) {
    return <span className="text-rose-400 dark:text-rose-300">{txt}</span>;
  }
  return (
    <>
      <span className="text-rose-400 dark:text-rose-300">{txt.slice(0, idx)}</span>
      <span> {txt.slice(idx + 1)}</span>
    </>
  );
};

interface LanguageDeckCardProps {
  front: string;
  back: string;
  example?: string;
  showAnswer: boolean;
  onEdit: () => void;
  editLabel: string;
  audioFront: string[];
  audioBack: string[];
}

const StackedPaper = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto w-full max-w-md">
    {/* Two paper layers behind the main card */}
    <div
      className="absolute inset-0 rounded-2xl bg-card border border-border shadow-sm"
      style={{ transform: 'translate(8px, 8px) rotate(0.6deg)' }}
      aria-hidden="true"
    />
    <div
      className="absolute inset-0 rounded-2xl bg-card border border-border shadow-sm"
      style={{ transform: 'translate(4px, 4px) rotate(-0.4deg)' }}
      aria-hidden="true"
    />
    <div className="relative rounded-2xl bg-card border border-border shadow-md">
      {children}
    </div>
  </div>
);

const LanguageDeckCard = ({
  front,
  back,
  example,
  showAnswer,
  onEdit,
  editLabel,
  audioFront,
  audioBack,
}: LanguageDeckCardProps) => {
  return (
    <StackedPaper>
      <div className="min-h-[360px] sm:min-h-[420px] px-6 py-8 flex flex-col items-center justify-center text-center">
        {showAnswer ? (
          // ---------- BACK ----------
          <>
            <div className="mb-5">
              <BookOpen className="w-16 h-16 text-orange-500" strokeWidth={1.6} />
            </div>
            <div className="flex items-center gap-2 text-base">
              <span className="font-medium">{renderHeadword(front)}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div
                className="text-2xl font-semibold anki-card-content"
                dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(back) }}
              />
            </div>
            {audioBack.map((url, i) => (
              <AudioPlayer key={`ab-${i}`} url={url} />
            ))}
            {example && (
              <>
                <div className="my-5 w-3/4 border-t border-dashed border-border" />
                <div className="flex items-start justify-center gap-2 text-sm text-muted-foreground max-w-sm">
                  <span
                    className="leading-snug"
                    dangerouslySetInnerHTML={{ __html: highlightExample(example, front) }}
                  />
                </div>
              </>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="mt-6 text-sky-400 hover:text-sky-500 transition-colors p-2"
              aria-label={editLabel}
              title={editLabel}
            >
              <Pencil className="w-5 h-5" />
            </button>
          </>
        ) : (
          // ---------- FRONT ----------
          <>
            <div className="flex items-center gap-3 text-2xl sm:text-3xl">
              <span className="font-medium">{renderHeadword(front)}</span>
            </div>
            {audioFront.map((url, i) => (
              <AudioPlayer key={`af-${i}`} url={url} autoPlay />
            ))}
            {example && (
              <p
                className="mt-4 text-sm text-muted-foreground max-w-sm leading-snug"
                dangerouslySetInnerHTML={{ __html: highlightExample(example, front) }}
              />
            )}
          </>
        )}
      </div>
    </StackedPaper>
  );
};

const AudioPlayer = ({ url, autoPlay = false }: { url: string; autoPlay?: boolean }) => {
  const ref = useRef<HTMLAudioElement>(null);
  return (
    <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-muted/40">
      <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
      <audio ref={ref} controls src={url} autoPlay={autoPlay} className="flex-1 h-8 max-w-full" />
    </div>
  );
};
