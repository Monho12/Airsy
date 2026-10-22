// 3D ↔ орлуулах харагдацыг `app/` сонгох (§8.6, §8.7, D57). building3d-ийн нийтийн API-г mock-оор удирдана.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { Building3DFallbackReason, Building3DProps } from '@/features/building3d';
import { initialUiState, useUiStore } from '@/store/uiStore';

const feature = vi.hoisted(() => ({
  webgl: true,
  mounts: 0,
  /** Дараагийн mount дээр мэдэгдэх шалтгаан; `null` бол хэвийн зурагдана */
  failWith: null as Building3DFallbackReason | null,
}));

vi.mock('@/features/building3d', async () => {
  const { useEffect } = await import('react');
  return {
    detectWebGL: () => feature.webgl,
    Building3D: ({ onFallback }: Building3DProps) => {
      useEffect(() => {
        feature.mounts += 1;
        if (feature.failWith !== null) onFallback(feature.failWith);
      }, [onFallback]);
      return <div data-testid="building3d" />;
    },
  };
});

const { Building3DRegion } = await import('./Building3DRegion');

const { building3d } = mn.common;
const retryButton = () => screen.queryByRole('button', { name: building3d.retry });
const resetButton = () => screen.queryByRole('button', { name: building3d.resetView });

beforeEach(() => {
  feature.webgl = true;
  feature.mounts = 0;
  feature.failWith = null;
  useUiStore.setState(initialUiState);
});

describe('Building3DRegion — «Харагдацыг сэргээх» (FR-B3, §10.3)', () => {
  it('3D горимд товч байх ба дарах бүрт cameraResetToken +1; сонголтыг өөрчлөхгүй', async () => {
    const user = userEvent.setup();
    useUiStore.getState().selectFloor('F05');
    render(<Building3DRegion />);

    await user.click(resetButton()!);
    await user.click(resetButton()!);

    expect(useUiStore.getState().cameraResetToken).toBe(2);
    expect(useUiStore.getState().selectedFloorId).toBe('F05');
  });

  it('гараар (Enter) ажиллана — бодит button', async () => {
    const user = userEvent.setup();
    render(<Building3DRegion />);
    resetButton()!.focus();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().cameraResetToken).toBe(1);
  });

  it.each(['WebGL байхгүй', '3D алдаа'] as const)(
    '%s → товч байхгүй (ажиллахгүй удирдлага зурахгүй, §8.7)',
    async (situation) => {
      if (situation === 'WebGL байхгүй') feature.webgl = false;
      else feature.failWith = 'render-error';
      render(<Building3DRegion />);
      await screen.findByRole('status');
      expect(resetButton()).not.toBeInTheDocument();
    },
  );
});

describe('Building3DRegion — харагдацыг сонгох (§8.6)', () => {
  it('WebGL байвал 3D-ийг шошготой region дотор зурна', () => {
    render(<Building3DRegion />);
    expect(screen.getByRole('region', { name: mn.common.regions.building3d })).toBeInTheDocument();
    expect(screen.getByTestId('building3d')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('WebGL байхгүй бол 3D-ийг огт mount хийхгүй, тайлбар харуулж, дахин оролдох товчгүй', () => {
    feature.webgl = false;
    render(<Building3DRegion />);
    expect(screen.queryByTestId('building3d')).not.toBeInTheDocument();
    expect(feature.mounts).toBe(0);
    expect(screen.getByRole('status')).toHaveTextContent(building3d.fallback['webgl-unavailable']);
    expect(retryButton()).not.toBeInTheDocument();
  });

  it.each(['render-error', 'context-lost'] as const)(
    '%s → тайлбар ба «Дахин оролдох» товч',
    async (reason) => {
      feature.failWith = reason;
      render(<Building3DRegion />);
      expect(await screen.findByRole('status')).toHaveTextContent(building3d.fallback[reason]);
      expect(screen.queryByTestId('building3d')).not.toBeInTheDocument();
      expect(retryButton()).toBeInTheDocument();
    },
  );
});

describe('Building3DRegion — сэргэлт (§8.7)', () => {
  it('«Дахин оролдох» нь 3D-ийг дахин mount хийж, амжилттай бол 3D руу буцна', async () => {
    feature.failWith = 'render-error';
    const user = userEvent.setup();
    render(<Building3DRegion />);
    await screen.findByRole('status');
    expect(feature.mounts).toBe(1);

    feature.failWith = null;
    await user.click(retryButton()!);

    expect(await screen.findByTestId('building3d')).toBeInTheDocument();
    expect(feature.mounts).toBe(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('дахин оролдоход алдаа давтагдвал орлуулах харагдацад үлдэнэ', async () => {
    feature.failWith = 'context-lost';
    const user = userEvent.setup();
    render(<Building3DRegion />);
    await screen.findByRole('status');

    await user.click(retryButton()!);

    expect(await screen.findByRole('status')).toHaveTextContent(
      building3d.fallback['context-lost'],
    );
    expect(feature.mounts).toBe(2);
  });
});
