import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectWebGL } from './detectWebGL';

type GetContext = HTMLCanvasElement['getContext'];

/** getContext-ийг context-ийн төрлөөр хариулдаг mock-оор солино */
function mockGetContext(impl: (type: string) => unknown) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(impl as unknown as GetContext);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectWebGL (FR-B9, D57)', () => {
  it('WebGL2 байвал true, шалгалтын context-ийг суллана', () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const getContext = mockGetContext((type) => (type === 'webgl2' ? { getExtension } : null));

    expect(detectWebGL()).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('WebGL2 байхгүй ч WebGL1 байвал true', () => {
    const getContext = mockGetContext((type) =>
      type === 'webgl' ? { getExtension: () => null } : null,
    );
    expect(detectWebGL()).toBe(true);
    expect(getContext).toHaveBeenNthCalledWith(1, 'webgl2');
    expect(getContext).toHaveBeenNthCalledWith(2, 'webgl');
  });

  it('аль ч context байхгүй бол false', () => {
    mockGetContext(() => null);
    expect(detectWebGL()).toBe(false);
  });

  it('getContext алдаа шидвэл false (апп унахгүй)', () => {
    mockGetContext(() => {
      throw new Error('GPU блоклогдсон');
    });
    expect(detectWebGL()).toBe(false);
  });
});
