import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { NAV_ITEMS, type ViewKey } from './components/navigation';
import { POSCounterView } from './components/POSCounterView';
import { InventoryView } from './components/InventoryView';
import { BarcodeStudioView } from './components/BarcodeStudioView';
import { KhataLedgerView } from './components/KhataLedgerView';
import { InvoicesWarrantyView } from './components/InvoicesWarrantyView';
import { ReportsDashboardView } from './components/ReportsDashboardView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { useTranslation } from './i18n/useTranslation';
import { setLanguageMode } from './services/settings';
import type { LanguageMode } from './types/pos';

const VIEW_KEYS = NAV_ITEMS.map((item) => item.key);

function isViewKey(value: string): value is ViewKey {
  return VIEW_KEYS.includes(value as ViewKey);
}

function readView(): ViewKey {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isViewKey(hash) ? hash : 'pos';
}

export function App() {
  const { settings } = useTranslation();
  const [view, setView] = useState<ViewKey>(readView);

  useEffect(() => {
    const handleHashChange = () => setView(readView());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((next: ViewKey) => {
    if (window.location.hash !== `#/${next}`) {
      window.location.hash = `/${next}`;
    }
    setView(next);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const index = Number(event.key) - 1;
      const item = NAV_ITEMS[index];
      if (item) {
        event.preventDefault();
        navigate(item.key);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigate]);

  const handleLanguageChange = useCallback((language: LanguageMode) => {
    void setLanguageMode(language).catch((error: unknown) => {
      console.error('Could not change language', error);
    });
  }, []);

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          Starting local database...
        </div>
      </div>
    );
  }

  return (
    <Layout
      activeView={view}
      onNavigate={navigate}
      onLanguageChange={handleLanguageChange}
      settings={settings}
    >
      {view === 'pos' ? <POSCounterView onNavigate={navigate} /> : null}
      {view === 'inventory' ? <InventoryView /> : null}
      {view === 'barcode' ? <BarcodeStudioView /> : null}
      {view === 'khata' ? <KhataLedgerView /> : null}
      {view === 'invoices' ? <InvoicesWarrantyView /> : null}
      {view === 'reports' ? <ReportsDashboardView /> : null}
      {view === 'settings' ? (
        <ShopSettingsView settings={settings} />
      ) : null}
    </Layout>
  );
}
