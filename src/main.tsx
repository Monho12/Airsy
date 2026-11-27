// Апп-ын эхлэх цэг. `LocalSimulationRuntime`-ийг үүсгэх цорын ганц газар (§9.3); React-аас гадна нэг удаа үүсгэх тул
// StrictMode-ийн давхар mount хоёр давталт үүсгэхгүй (§11.5). Store adapter-аар холбоод автоматаар эхэлнэ (D73).
// Барилгын өгөгдөл frontend-д БАЙХГҮЙ (D106): эхлээд backend-ийн `GET /api/config`-оос ачаална, дараа нь л
// симуляци ба UI эхэлнэ. Сервер ажиллахгүй бол «Дахин оролдох» дэлгэц.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { StartupScreen } from '@/app/StartupScreen';
import { LocalSimulationRuntime } from '@/domain/runtime/LocalSimulationRuntime';
import { fetchBuildingConfig } from '@/features/server-status';
import { connectRuntime } from '@/store/adapter';
import { setBuildingConfig } from '@/store/buildingConfig';
import { registerRuntime } from '@/store/runtime';

import '@/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root элемент олдсонгүй');
const root = createRoot(container);

async function boot(): Promise<void> {
  root.render(<StartupScreen state="loading" />);
  let config;
  try {
    config = await fetchBuildingConfig();
  } catch {
    root.render(<StartupScreen state="error" onRetry={() => void boot()} />);
    return;
  }

  // Тохиргоог store-д тавьсны ДАРАА л runtime ба UI (тэд `getBuildingConfig()`-оор уншина)
  setBuildingConfig(config);
  const runtime = new LocalSimulationRuntime({ config });
  registerRuntime(runtime);
  connectRuntime(runtime);
  runtime.start();

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
