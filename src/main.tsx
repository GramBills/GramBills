import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initializeDatabase } from './db/database';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element was not found.');
}

const root = createRoot(container);

initializeDatabase()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown startup error.';
    root.render(
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            GramBill POS could not start
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Reload the page. If the problem continues, restore a recent JSON
            backup.
          </p>
        </div>
      </div>,
    );
  });
