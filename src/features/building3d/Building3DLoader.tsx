// 3D хэсгийг хойшлуулж ачаална (CLAUDE.md §11.3, D57). Энэ файл 3D санг импортлохгүй — `three`, R3F, Drei нь
// зөвхөн `./Building3D`-ийн тусдаа chunk-д орж, dashboard 3D-ээс өмнө харагдана.
import { lazy, Suspense, useState } from 'react';

import { Skeleton } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';

import { Building3DErrorBoundary } from './Building3DErrorBoundary';
import type { Building3DProps } from './types';

const loadBuilding3D = () =>
  import('./Building3D').then((module) => ({ default: module.Building3D }));

export function Building3DLoader({ onFallback, config }: Building3DProps) {
  // Mount бүрт шинэ lazy — «Дахин оролдох» (app дахин mount хийнэ) нь амжилтгүй болсон ачаалалтыг дахин эхлүүлнэ
  const [LazyBuilding3D] = useState(() => lazy(loadBuilding3D));

  return (
    <Building3DErrorBoundary onError={() => onFallback('render-error')}>
      <Suspense fallback={<Skeleton label={mn.common.building3d.loading} />}>
        <LazyBuilding3D onFallback={onFallback} config={config} />
      </Suspense>
    </Building3DErrorBoundary>
  );
}
