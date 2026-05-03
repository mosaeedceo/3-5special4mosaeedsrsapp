import { Home, BookMarked, Layers, BarChart3, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from '@/hooks/useTranslation';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, getDueTodayLessons, getMissedLessons } = useLocalStorage();
  const { isTabletMode, containerClass } = useDisplayMode(data.settings.displayMode);
  const { t } = useTranslation();

  const dueCount = getDueTodayLessons().length + getMissedLessons().length;

  const isFlashcardsPath = location.pathname.startsWith('/flashcards');

  const navItems = [
    { icon: Home, label: t('nav.tasks'), path: '/', badge: dueCount > 0 ? dueCount : null, isActive: location.pathname === '/' },
    { icon: BookMarked, label: t('nav.browse'), path: '/browse', badge: null, isActive: ['/browse', '/library', '/categories'].includes(location.pathname) },
    { icon: Layers, label: t('nav.flashcards'), path: '/flashcards', badge: null, isActive: isFlashcardsPath },
    { icon: BarChart3, label: t('nav.stats'), path: '/stats', badge: null, isActive: location.pathname === '/stats' },
    { icon: Settings, label: t('nav.settings'), path: '/settings', badge: null, isActive: location.pathname === '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className={cn(
        'mx-auto flex items-center justify-around py-2 px-4',
        containerClass
      )}>
        {navItems.map(({ icon: Icon, label, path, badge, isActive }) => {
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg transition-all duration-200 flex-1 min-w-0',
                isTabletMode ? 'px-4 py-3' : 'px-1 py-2',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'rounded-xl transition-all duration-200 relative',
                isTabletMode ? 'p-2' : 'p-1.5',
                isActive && 'bg-primary/10'
              )}>
                <Icon className={cn(
                  isTabletMode ? 'w-5 h-5' : 'w-4 h-4',
                  isActive && 'scale-110'
                )} />
                {badge !== null && (
                  <span className={cn(
                    'absolute flex items-center justify-center bg-danger text-danger-foreground font-bold rounded-full',
                    isTabletMode ? '-top-1 -right-1 min-w-[18px] h-[18px] text-[10px] px-1' : '-top-1 -right-1.5 min-w-[16px] h-[16px] text-[9px] px-0.5'
                  )}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'font-medium truncate max-w-full',
                isTabletMode ? 'text-xs' : 'text-[10px]'
              )}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
