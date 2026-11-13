import { useEffect, useState, type ReactNode } from 'react';
import { HardDrive, Store, Wifi, WifiOff } from 'lucide-react';
import { APP_NAME, APP_VERSION } from '../lib/appInfo';
import { cn } from '../lib/cn';
import { translations, type TranslationKey } from '../i18n/translations';
import type { LanguageMode, ShopSettings } from '../types/pos';
import { NAV_ITEMS, type ViewKey } from './navigation';

interface LayoutProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onLanguageChange: (language: LanguageMode) => void;
  settings: ShopSettings;
  children: ReactNode;
}

export function Layout({
  activeView,
  onNavigate,
  onLanguageChange,
  settings,
  children,
}: LayoutProps) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const t = (key: TranslationKey): string =>
    translations[settings.languageMode]?.[key] ??
    translations.en[key] ??
    key;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col bg-slate-950 text-slate-100 lg:w-64">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-3 lg:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
            <Store className="h-5 w-5" />
          </span>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-bold tracking-tight">
              {APP_NAME}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {t('app.tagline')}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 lg:px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeView;
            return (
              <button
                key={item.key}
                type="button"
                title={`${t(item.labelKey)} (${item.shortcut})`}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden min-w-0 flex-1 truncate text-sm font-medium lg:block">
                  {t(item.labelKey)}
                </span>
                <span className="hidden shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 lg:block">
                  {item.shortcut}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 lg:p-4">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
            <HardDrive className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] font-medium leading-4 text-slate-300">
                {t('status.dataLocal')}
              </p>
              <p className="text-[10px] text-slate-500">v{APP_VERSION}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {settings.shopName}
              </p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {settings.ownerName} · {settings.phone}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                  online
                    ? 'bg-sky-50 text-sky-700 ring-sky-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                )}
              >
                {online ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {online ? t('status.online') : t('status.offline')}
                </span>
              </span>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    settings.languageMode === 'en'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                  aria-pressed={settings.languageMode === 'en'}
                >
                  {t('lang.english')}
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('hinglish')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    settings.languageMode === 'hinglish'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                  aria-pressed={settings.languageMode === 'hinglish'}
                >
                  {t('lang.hinglish')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
