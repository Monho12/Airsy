// Сервертэй холболтын тэмдэг ба REST API adapter (D105).
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';

import { API_URL, fetchBuildingInfo, type BuildingInfo } from './api';
import { ServerStatus } from './ServerStatus';

const text = mn.common.server;

const INFO: BuildingInfo = {
  id: 'aeris-tower',
  name: 'AERIS Tower',
  floorCount: 12,
  floors: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ServerStatus', () => {
  it('эхлээд «шалгаж байна» гэж харуулна', () => {
    render(<ServerStatus load={() => new Promise(() => {})} />);
    expect(screen.getByText(text.loading)).toBeInTheDocument();
  });

  it('серверээс ирсэн давхрын тоог харуулна', async () => {
    render(<ServerStatus load={async () => INFO} />);
    expect(await screen.findByText(text.online(12))).toHaveAttribute(
      'title',
      text.onlineTitle('AERIS Tower'),
    );
  });

  it('сервер ажиллахгүй бол «холболтгүй» гэж харуулна', async () => {
    render(<ServerStatus load={() => Promise.reject(new Error('down'))} />);
    expect(await screen.findByText(text.offline)).toBeInTheDocument();
  });
});

describe('fetchBuildingInfo', () => {
  it('GET /api/building хийж JSON буцаана', async () => {
    const fetchMock = vi.fn(async () => Response.json(INFO));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchBuildingInfo()).resolves.toEqual(INFO);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/building`, expect.anything());
  });

  it('HTTP алдааг throw хийнэ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    await expect(fetchBuildingInfo()).rejects.toThrow('HTTP 500');
  });
});
