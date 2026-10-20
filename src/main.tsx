// Апп-ын эхлэх цэг. Phase 4-өөс энд LocalSimulationRuntime-ийг үүсгэж store adapter-т холбоно (§9.3).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';

import '@/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root элемент олдсонгүй');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
