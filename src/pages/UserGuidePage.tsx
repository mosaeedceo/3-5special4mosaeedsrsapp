import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import {
  BookOpen, Plus, Brain, BarChart3, FolderOpen, ListChecks,
  Paperclip, Settings, Lightbulb, GraduationCap, ChevronLeft,
  ChevronRight, ChevronDown, ChevronUp, Star, Clock, Target,
  Zap, AlertTriangle, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GuideSection {
  id: string;
  icon: any;
  color: string;
  image: string;
  titleKey: string;
  descKey: string;
  contentKey: string;
  scenarioKey?: string;
  tipsKey?: string;
}

const sections: GuideSection[] = [
  {
    id: 'getting-started',
    icon: BookOpen,
    color: 'text-primary bg-primary/15',
    image: '/images/guide/getting-started.png',
    titleKey: 'guide.gettingStarted.title',
    descKey: 'guide.gettingStarted.desc',
    contentKey: 'guide.gettingStarted.content',
    scenarioKey: 'guide.gettingStarted.scenario',
  },
  {
    id: 'adding-lessons',
    icon: Plus,
    color: 'text-primary bg-primary/15',
    image: '/images/guide/add-lessons.png',
    titleKey: 'guide.addingLessons.title',
    descKey: 'guide.addingLessons.desc',
    contentKey: 'guide.addingLessons.content',
    scenarioKey: 'guide.addingLessons.scenario',
    tipsKey: 'guide.addingLessons.tips',
  },
  {
    id: 'categories',
    icon: FolderOpen,
    color: 'text-violet-500 bg-violet-500/15',
    image: '/images/guide/categories.png',
    titleKey: 'guide.categories.title',
    descKey: 'guide.categories.desc',
    contentKey: 'guide.categories.content',
    scenarioKey: 'guide.categories.scenario',
    tipsKey: 'guide.categories.tips',
  },
  {
    id: 'reviewing',
    icon: Brain,
    color: 'text-amber-500 bg-amber-500/15',
    image: '/images/guide/review-rate.png',
    titleKey: 'guide.reviewing.title',
    descKey: 'guide.reviewing.desc',
    contentKey: 'guide.reviewing.content',
    scenarioKey: 'guide.reviewing.scenario',
    tipsKey: 'guide.reviewing.tips',
  },
  {
    id: 'spaced-repetition',
    icon: GraduationCap,
    color: 'text-blue-500 bg-blue-500/15',
    image: '/images/guide/spaced-repetition.png',
    titleKey: 'guide.spacedRepetition.title',
    descKey: 'guide.spacedRepetition.desc',
    contentKey: 'guide.spacedRepetition.content',
    scenarioKey: 'guide.spacedRepetition.scenario',
  },
  {
    id: 'daily-tasks',
    icon: ListChecks,
    color: 'text-green-500 bg-green-500/15',
    image: '/images/guide/daily-tasks.png',
    titleKey: 'guide.dailyTasks.title',
    descKey: 'guide.dailyTasks.desc',
    contentKey: 'guide.dailyTasks.content',
    scenarioKey: 'guide.dailyTasks.scenario',
    tipsKey: 'guide.dailyTasks.tips',
  },
  {
    id: 'statistics',
    icon: BarChart3,
    color: 'text-rose-500 bg-rose-500/15',
    image: '/images/guide/statistics.png',
    titleKey: 'guide.statistics.title',
    descKey: 'guide.statistics.desc',
    contentKey: 'guide.statistics.content',
    scenarioKey: 'guide.statistics.scenario',
  },
  {
    id: 'attachments',
    icon: Paperclip,
    color: 'text-indigo-500 bg-indigo-500/15',
    image: '/images/guide/attachments.png',
    titleKey: 'guide.attachments.title',
    descKey: 'guide.attachments.desc',
    contentKey: 'guide.attachments.content',
    scenarioKey: 'guide.attachments.scenario',
  },
  {
    id: 'settings',
    icon: Settings,
    color: 'text-slate-500 bg-slate-500/15',
    image: '/images/guide/settings.png',
    titleKey: 'guide.settings.title',
    descKey: 'guide.settings.desc',
    contentKey: 'guide.settings.content',
  },
  {
    id: 'tips',
    icon: Lightbulb,
    color: 'text-emerald-500 bg-emerald-500/15',
    image: '/images/guide/tips.png',
    titleKey: 'guide.tips.title',
    descKey: 'guide.tips.desc',
    contentKey: 'guide.tips.content',
  },
];

const SectionCard = ({ section, index }: { section: GuideSection; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const { t, isRTL } = useTranslation();
  const Icon = section.icon;

  const contentLines = t(section.contentKey).split('\n').filter(Boolean);
  const scenarioLines = section.scenarioKey ? t(section.scenarioKey).split('\n').filter(Boolean) : [];
  const tipsLines = section.tipsKey ? t(section.tipsKey).split('\n').filter(Boolean) : [];

  return (
    <Card
      className="overflow-hidden animate-fade-in border-border/60"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn("w-full", isRTL ? "text-right" : "text-left")}
      >
        <div className="relative">
          <img
            src={section.image}
            alt=""
            className="w-full h-36 sm:h-44 object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className={cn("absolute bottom-3 px-4 flex items-center gap-2", isRTL ? "right-0" : "left-0")}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", section.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white drop-shadow-md">
                {t(section.titleKey)}
              </h3>
              <p className="text-[11px] text-white/80 drop-shadow-md">
                {t(section.descKey)}
              </p>
            </div>
          </div>
          <div className={cn("absolute top-3 p-1 rounded-full bg-black/30", isRTL ? "left-3" : "right-3")}>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <CardContent className={cn("p-4 space-y-4 animate-fade-in")} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="space-y-2">
            {contentLines.map((line, i) => {
              const isBullet = line.startsWith('•') || line.startsWith('-');
              const isHeader = line.startsWith('#');

              if (isHeader) {
                return (
                  <h4 key={i} className={cn("text-sm font-semibold text-foreground mt-3 first:mt-0", isRTL && "text-right")}>
                    {line.replace(/^#+\s*/, '')}
                  </h4>
                );
              }

              if (isBullet) {
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <ArrowRight className={cn("w-3.5 h-3.5 text-primary mt-0.5 shrink-0", isRTL && "rotate-180")} />
                    <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
                      {line.replace(/^[•-]\s*/, '')}
                    </p>
                  </div>
                );
              }

              return (
                <p key={i} className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
                  {line}
                </p>
              );
            })}
          </div>

          {scenarioLines.length > 0 && (
            <div className={cn("p-3 rounded-lg bg-primary/5 border border-primary/15", isRTL && "text-right")}>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {t('guide.useCase')}
                </span>
              </div>
              {scenarioLines.map((line, i) => (
                <p key={i} className={cn("text-[11px] text-muted-foreground leading-relaxed mb-1 last:mb-0", isRTL && "text-right")}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {tipsLines.length > 0 && (
            <div className={cn("p-3 rounded-lg bg-amber-500/5 border border-amber-500/15", isRTL && "text-right")}>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">
                  {t('guide.proTips')}
                </span>
              </div>
              {tipsLines.map((line, i) => (
                <div key={i} className="flex gap-2 mb-1 last:mb-0">
                  <Star className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <p className={cn("text-[11px] text-muted-foreground leading-relaxed", isRTL && "text-right")}>
                    {line.replace(/^[•-]\s*/, '')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export const UserGuidePage = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  const { data } = useLocalStorage();
  const { containerClass } = useDisplayMode(data.settings.displayMode);

  return (
    <div className="min-h-screen bg-background pb-24 animate-fade-in">
      <header className="bg-card border-b border-border px-4 pt-8 pb-4">
        <div className={`${containerClass} mx-auto`}>
          <div className={cn("flex items-center gap-2 mb-3", isRTL && "flex-row-reverse")}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="h-8 w-8 p-0"
            >
              {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
              <div className={cn("flex items-center gap-2 mb-0.5", isRTL && "flex-row-reverse")}>
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground text-xs font-medium">
                  {t('guide.subtitle')}
                </span>
              </div>
              <h1 className="font-heading text-xl font-bold text-foreground">
                {t('guide.title')}
              </h1>
            </div>
          </div>
          <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
            {t('guide.headerDesc')}
          </p>
        </div>
      </header>

      <main className={`${containerClass} mx-auto px-4 py-4 space-y-3`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex flex-wrap gap-1.5 mb-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  const el = document.getElementById(`guide-${section.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium",
                  "border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                )}
              >
                <Icon className="w-3 h-3" />
                {t(section.titleKey)}
              </button>
            );
          })}
        </div>

        {sections.map((section, index) => (
          <div key={section.id} id={`guide-${section.id}`}>
            <SectionCard section={section} index={index} />
          </div>
        ))}

        <Card className="overflow-hidden border-primary/20 bg-primary/5">
          <CardContent className={cn("p-4 text-center", isRTL && "text-right")}>
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              {t('guide.readyTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {t('guide.readyDesc')}
            </p>
            <Button onClick={() => navigate('/')} size="sm" className="h-9">
              {t('guide.startStudying')}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
