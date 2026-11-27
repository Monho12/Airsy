// Сервертэй холбогдсон эсэхийн тэмдэг (D105). Нээгдэхэд нэг удаа GET /api/building хийнэ.
// Симуляци серверээс хамаарахгүй тул холболтгүй үед ч апп хэвийн ажиллана (§1.3).
import { useEffect, useState } from 'react';

import { mn } from '@/domain/i18n/mn';

import { fetchBuildingInfo, type BuildingInfo } from './api';

import './ServerStatus.css';

const text = mn.common.server;

type ServerState =
  { kind: 'loading' } | { kind: 'online'; info: BuildingInfo } | { kind: 'offline' };

interface ServerStatusProps {
  /** Өгөгдөл авах функц — тестэд солино */
  load?: (signal: AbortSignal) => Promise<BuildingInfo>;
}

export function ServerStatus({ load = fetchBuildingInfo }: ServerStatusProps) {
  const [state, setState] = useState<ServerState>({ kind: 'loading' });

  useEffect(() => {
    // Компонент алга болбол хүсэлтийг цуцална (StrictMode-ийн давхар mount-д ч)
    const controller = new AbortController();
    load(controller.signal).then(
      (info) => setState({ kind: 'online', info }),
      () => {
        if (!controller.signal.aborted) setState({ kind: 'offline' });
      },
    );
    return () => controller.abort();
  }, [load]);

  // Төлөвийг зөвхөн өнгөөр биш, бичвэрээр ч харуулна (§8.3)
  const label =
    state.kind === 'online'
      ? text.online(state.info.floorCount)
      : state.kind === 'offline'
        ? text.offline
        : text.loading;
  const title =
    state.kind === 'online'
      ? text.onlineTitle(state.info.name)
      : state.kind === 'offline'
        ? text.offlineTitle
        : undefined;

  return (
    <p className="server-status" data-state={state.kind} title={title}>
      <span className="server-status__dot" aria-hidden="true" />
      {label}
    </p>
  );
}
