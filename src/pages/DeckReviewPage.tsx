import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Volume2, RotateCcw, Brain, Zap, Plus, Pencil, Trash2, MoreVertical, Square } from 'lucide-react';
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
import { speak as ttsSpeak, cancel as ttsCancel, subscribeSpeaking } from '@/lib/tts';
import { detectLanguage } from '@/lib/langDetect';
import { cn } from '@/lib/utils';
import { CardEditorDialog } from '@/components/CardEditorDialog';
import { InstallVoicesDialog } from '@/components/InstallVoicesDialog';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { checkLanguageStatus, isInstallSupported } from '@/lib/ttsInstaller';

// Module-scoped session memory: deck IDs we've already prompted/dismissed for
// during the current app session. Cleared on full app reload.
const promptedDecksThisSession = new Set<string>();

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
  const [installVoicesOpen, setInstallVoicesOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
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
  const deckFrontLang = deck?.ttsFrontLang;
  const deckBackLang = deck?.ttsBackLang;
  const ttsRate = deck?.ttsRate ?? 1.0;
  const ttsAutoPlay = deck?.ttsAutoPlay ?? false;

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

  // Reset reveal state when moving to next card; cancel any in-flight TTS so cards don't overlap
  useEffect(() => {
    setShowAnswer(false);
    ttsCancel();
  }, [position]);

  // Cancel TTS on unmount / route change
  useEffect(() => {
    return () => { ttsCancel(); };
  }, []);

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

  // Mirror the global TTS speaking-state into local state so Stop/Replay UI
  // reflects reality on both web and native.
  useEffect(() => {
    return subscribeSpeaking(setSpeaking);
  }, []);

  // Effective per-card language: explicit card override → auto-detect from text
  // → deck default. The voice URI is only meaningful when the lang matches the
  // deck-configured language; if detection picked a different lang, we let the
  // platform pick a default voice for that language.
  const effectiveFrontLang =
    currentCard?.ttsLangFront ||
    (resolved ? detectLanguage(resolved.front) : null) ||
    deckFrontLang ||
    '';
  const effectiveBackLang =
    currentCard?.ttsLangBack ||
    (resolved ? detectLanguage(resolved.back) : null) ||
    deckBackLang ||
    '';

  const speakSide = (side: 'front' | 'back') => {
    if (!resolved) return;
    const lang = side === 'front' ? effectiveFrontLang : effectiveBackLang;
    if (!lang) return;
    const deckLang = side === 'front' ? deckFrontLang : deckBackLang;
    const deckVoice = side === 'front' ? deck?.ttsFrontVoiceURI : deck?.ttsBackVoiceURI;
    // Only reuse the deck-configured voice if the resolved language matches
    // what the deck voice was picked for; otherwise let the platform default.
    const voiceURI = lang === deckLang ? deckVoice : undefined;
    const text = side === 'front' ? resolved.front : resolved.back;
    ttsSpeak({ text, lang, voiceURI, rate: ttsRate });
  };

  // Auto-prompt: if this deck wants TTS but the required system voices aren't
  // installed, offer the install flow once per deck per app session. Native
  // Android only; silently no-ops on web/iOS.
  useEffect(() => {
    if (!deckId || !deck) return;
    if (!isInstallSupported()) return;
    if (promptedDecksThisSession.has(deckId)) return;

    const wantsTts = !!(ttsAutoPlay || deckFrontLang || deckBackLang);
    if (!wantsTts) return;

    const langs = Array.from(
      new Set([deckFrontLang, deckBackLang].filter((l): l is string => !!l)),
    );
    if (langs.length === 0) return;

    let cancelled = false;
    (async () => {
      const statuses = await Promise.all(langs.map(l => checkLanguageStatus(l)));
      if (cancelled) return;
      const needsInstall = statuses.some(s => s === 'missing' || s === 'engineMissing');
      if (!needsInstall) return;
      // Mark as prompted up-front so we never re-prompt this session, even
      // if the user dismisses without acting.
      promptedDecksThisSession.add(deckId);
      toast({
        title: t('tts.installPromptTitle'),
        description: t('tts.installPromptDesc'),
        action: (
          <ToastAction
            altText={t('tts.installPromptCta')}
            onClick={() => setInstallVoicesOpen(true)}
          >
            {t('tts.installPromptCta')}
          </ToastAction>
        ),
      });
    })();

    return () => { cancelled = true; };
    // Run once per deck mount; deck/lang values are stable for a given deckId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Auto-play front when a new card is shown
  useEffect(() => {
    if (!ttsAutoPlay || !effectiveFrontLang || !resolved) return;
    speakSide('front');
    // We intentionally only depend on the resolved content + autoplay/lang flags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, ttsAutoPlay, effectiveFrontLang]);

  // Auto-play back when the answer is revealed
  useEffect(() => {
    if (!ttsAutoPlay || !effectiveBackLang || !resolved || !showAnswer) return;
    speakSide('back');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, resolved, ttsAutoPlay, effectiveBackLang]);

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
        installVoicesOpen ||
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
      const k = e.key.toLowerCase();
      if (k === 'r') {
        e.preventDefault();
        const side: 'front' | 'back' = showAnswer ? 'back' : 'front';
        speakSide(side);
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
    // speakSide / handleRate / handleExit close over the latest state via the
    // listed deps; the listener is re-registered on relevant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    addCardOpen,
    editCardOpen,
    confirmDeleteOpen,
    installVoicesOpen,
    exitConfirmOpen,
    sessionDone,
    showAnswer,
    currentCard,
    resolved,
    effectiveFrontLang,
    effectiveBackLang,
    queue.length,
    position,
  ]);

  const handleAddCardSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    ttsLangFront?: string;
    ttsLangBack?: string;
  }) => {
    if (!deckId) return;
    const now = new Date().toISOString();
    const card: FlashCard = {
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
    addCards([card]);
    toast({ title: t('flashcards.cardAdded') });
  };

  const handleEditCardSubmit = (values: {
    front: string;
    back: string;
    tags: string[];
    ttsLangFront?: string;
    ttsLangBack?: string;
  }) => {
    if (!currentCard) return;
    updateCard(currentCard.id, {
      front: values.front,
      back: values.back,
      tags: values.tags.length ? values.tags : undefined,
      ttsLangFront: values.ttsLangFront,
      ttsLangBack: values.ttsLangBack,
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
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px]">
                    {t('flashcards.front')}
                  </Badge>
                  {effectiveFrontLang && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => speakSide('front')}
                        className="h-7 w-7"
                        aria-label={speaking ? t('tts.replay') : t('tts.speak')}
                        title={speaking ? t('tts.replay') : t('tts.speak')}
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                      {speaking && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={ttsCancel}
                          className="h-7 w-7 text-danger hover:text-danger"
                          aria-label={t('tts.stop')}
                          title={t('tts.stop')}
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </Button>
                      )}
                    </div>
                  )}
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
                      {effectiveBackLang && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => speakSide('back')}
                            className="h-7 w-7"
                            aria-label={speaking ? t('tts.replay') : t('tts.speak')}
                            title={speaking ? t('tts.replay') : t('tts.speak')}
                          >
                            <Volume2 className="w-4 h-4" />
                          </Button>
                          {speaking && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={ttsCancel}
                              className="h-7 w-7 text-danger hover:text-danger"
                              aria-label={t('tts.stop')}
                              title={t('tts.stop')}
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                            </Button>
                          )}
                        </div>
                      )}
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

      <InstallVoicesDialog
        open={installVoicesOpen}
        onOpenChange={setInstallVoicesOpen}
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

const AudioPlayer = ({ url, autoPlay = false }: { url: string; autoPlay?: boolean }) => {
  const ref = useRef<HTMLAudioElement>(null);
  return (
    <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-muted/40">
      <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
      <audio ref={ref} controls src={url} autoPlay={autoPlay} className="flex-1 h-8 max-w-full" />
    </div>
  );
};
