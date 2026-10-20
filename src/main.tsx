// Апп-ын эхлэх цэг. Phase 4-өөс энд LocalSimulationRuntime-ийг үүсгэж store adapter-т холбоно (§9.3).
// Phase 2: тохиргооноос үүсгэсэн тогтмол жишээ snapshot-ийг ижил adapter-аар ачаална (§13 Phase 2).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { applySnapshot } from '@/store/adapter';
import { createMockSnapshot } from '@/store/mockSnapshot';

import '@/styles/globals.css';

applySnapshot(createMockSnapshot());

const container = document.getElementById('root');
if (!container) throw new Error('#root элемент олдсонгүй');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
