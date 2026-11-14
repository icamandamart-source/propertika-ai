import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { reportClientError } from './lib/client-logger';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemen #root tidak ditemukan di index.html');

function describeReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason) ?? 'Promise ditolak tanpa alasan.';
  } catch {
    return 'Promise ditolak tanpa alasan.';
  }
}

window.addEventListener('error', (event) => {
  reportClientError({
    message: event.message || 'Kesalahan peramban tanpa pesan.',
    source: event.filename,
    stack: event.error instanceof Error ? event.error.stack : undefined,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientError({
    message: describeReason(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined,
  });
});

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);