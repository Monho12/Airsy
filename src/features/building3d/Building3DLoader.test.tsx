// Lazy ачаалалт ба error boundary (§11.3, §8.7, D57). jsdom-д WebGL байхгүй тул жинхэнэ canvas-ийн оронд
// `./Building3D`-ийг mock-оор солино (§12.1: 3D компонентод логик оруулахгүй, орлуулах замыг тестлэнэ).
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBuildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';

import type { Building3DProps } from './types';

const scene = vi.hoisted(() => ({
  imported: 0,
  behavior: 'render' as 'render' | 'throw' | 'context-lost',
}));

vi.mock('./Building3D', () => {
  scene.imported += 1;
  return {
    Building3D: ({ onFallback, config }: Building3DProps) => {
      if (scene.behavior === 'throw') throw new Error('зурах алдаа');
      if (scene.behavior === 'context-lost') onFallback('context-lost');
      return (
        <div data-testid="scene" data-floors={config?.building.floorIds.length ?? 'default'} />
      );
    },
  };
});

// Mock-ийн дараа импортолно (vi.mock hoisted)
const { Building3D } = await import('./index');

beforeEach(() => {
  scene.behavior = 'render';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Building3D — lazy ачаалалт (§11.3)', () => {
  it('index-ийг импортлоход 3D модуль ачаалагдахгүй; анх зурахад ачаалж буй төлөв, дараа нь scene', async () => {
    expect(scene.imported).toBe(0);

    render(<Building3D onFallback={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(mn.common.building3d.loading);

    expect(await screen.findByTestId('scene')).toBeInTheDocument();
    expect(scene.imported).toBe(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('config prop-ийг lazy scene рүү дамжуулна (D57, FR-B1)', async () => {
    render(<Building3D onFallback={vi.fn()} config={createBuildingConfig(6)} />);
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-floors', '6');
  });
});

describe('Building3D — алдааг app руу дамжуулна (§8.6, §8.7)', () => {
  it('зурах үеийн алдаа → onFallback("render-error"), өөрөө орлуулах UI зурахгүй', async () => {
    scene.behavior = 'throw';
    // React барьсан алдааг console-д бичдэг — тестийн гаралтыг цэвэр байлгана
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onFallback = vi.fn();

    const { container } = render(<Building3D onFallback={onFallback} />);

    await vi.waitFor(() => expect(onFallback).toHaveBeenCalledWith('render-error'));
    expect(onFallback).toHaveBeenCalledOnce();
    expect(container).toBeEmptyDOMElement();
  });

  it('scene-ийн мэдэгдсэн шалтгааныг (context-lost) өөрчлөхгүй дамжуулна', async () => {
    scene.behavior = 'context-lost';
    const onFallback = vi.fn();

    render(<Building3D onFallback={onFallback} />);

    await vi.waitFor(() => expect(onFallback).toHaveBeenCalledWith('context-lost'));
    expect(onFallback).not.toHaveBeenCalledWith('render-error');
  });
});
