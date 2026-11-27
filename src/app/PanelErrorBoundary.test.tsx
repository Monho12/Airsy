// Самбарын error boundary (§8.7, §11.5, Phase 7c): нэг самбарын алдаа бусдыг унагахгүй, «Дахин оролдох» ажиллана.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';

import { PanelErrorBoundary } from './PanelErrorBoundary';

let shouldThrow = true;

function Flaky() {
  if (shouldThrow) throw new Error('туршилтын алдаа');
  return <p>Самбар ажиллаж байна</p>;
}

beforeEach(() => {
  shouldThrow = true;
  // React алдааг console-д бичдэг — тестийн гаралтыг цэвэр байлгана
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelErrorBoundary', () => {
  it('алдаа гарсан самбарын оронд гарчигтай мессеж, хөрш самбар хэвээр', () => {
    render(
      <>
        <PanelErrorBoundary title="Туршилтын самбар">
          <Flaky />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Хөрш самбар">
          <p>Хөрш ажиллаж байна</p>
        </PanelErrorBoundary>
      </>,
    );
    expect(screen.getByRole('region', { name: 'Туршилтын самбар' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(mn.common.panelError.message);
    expect(screen.getByText('Хөрш ажиллаж байна')).toBeInTheDocument();
  });

  it('«Дахин оролдох» самбарыг шинээр зурна', async () => {
    const user = userEvent.setup();
    render(
      <PanelErrorBoundary title="Туршилтын самбар">
        <Flaky />
      </PanelErrorBoundary>,
    );
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: mn.common.panelError.retry }));
    expect(screen.getByText('Самбар ажиллаж байна')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
