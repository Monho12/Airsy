// Апп-ын эхлэх цэг. `LocalSimulationRuntime`-ийг үүсгэх цорын ганц газар (§9.3); React-аас гадна нэг удаа үүсгэх тул
// StrictMode-ийн давхар mount хоёр давталт үүсгэхгүй (§11.5). Store adapter-аар холбоод автоматаар эхэлнэ (D73).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { LocalSimulationRuntime } from '@/domain/runtime/LocalSimulationRuntime';
import { connectRuntime } from '@/store/adapter';
import { registerRuntime } from '@/store/runtime';

import '@/styles/globals.css';

const runtime = new LocalSimulationRuntime();
registerRuntime(runtime);
connectRuntime(runtime);
runtime.start();

const container = document.getElementById('root');
if (!container) throw new Error('#root элемент олдсонгүй');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
