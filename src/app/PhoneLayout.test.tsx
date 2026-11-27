// Утасны табтай бүтэц (§8.2, D52, Phase 7b): таб солих, гарын удирдлага, 3D-ийг хойшлуулж ачаалах.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { App } from './App';

const tabs = mn.common.phoneTabs;

/** Утасны өргөн: зөвхөн `(max-width: 767px)` таарна (хөдөлгөөн багасгах асуулт таарахгүй) */
function stubPhoneViewport() {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(() => {
  useLiveStore.setState(initialLiveState, true);
  useUiStore.setState(initialUiState);
  stubPhoneViewport();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderPhone({ webgl }: { webgl: boolean }) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    webgl ? ({ getExtension: () => null } as unknown as RenderingContext) : null,
  );
  applySnapshot(createMockSnapshot());
  return { user: userEvent.setup(), ...render(<App />) };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });

describe('Утасны табтай бүтэц', () => {
  it('4 таб; анхдагч «Барилга» — давхрын жагсаалт харагдана, дохионы самбар нуугдсан', () => {
    renderPhone({ webgl: false });
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(tab(tabs.building)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('listbox')).toBeVisible();
    // Идэвхгүй табын агуулга mount хийгдсэн ч нуугдсан (`hidden`)
    const alertsPanel = document.getElementById(tab(tabs.alerts).getAttribute('aria-controls')!);
    expect(alertsPanel).not.toBeVisible();
  });

  it('таб дарахад тухайн хэсэг харагдаж, бусад нь нуугдана', async () => {
    const { user } = renderPhone({ webgl: false });
    await user.click(tab(tabs.alerts));
    expect(tab(tabs.alerts)).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('region', { name: mn.common.regions.alerts })).toBeVisible();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('гарын удирдлага: ←/→ ба Home/End, идэвхтэй таб л Tab-аар хүрнэ', async () => {
    const { user } = renderPhone({ webgl: false });
    tab(tabs.building).focus();
    await user.keyboard('{ArrowRight}');
    expect(tab(tabs.alerts)).toHaveFocus();
    expect(tab(tabs.alerts)).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tab(tabs.scenarios)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab(tabs.building)).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tab(tabs.scenarios)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab(tabs.building)).toHaveFocus();
    expect(tab(tabs.building)).toHaveAttribute('tabindex', '0');
    expect(tab(tabs.alerts)).toHaveAttribute('tabindex', '-1');
  });

  it('WebGL байгаа ч утсан дээр 3D-ийг анхдагчаар ачаалахгүй — «3D харагдац ачаалах» товч', () => {
    renderPhone({ webgl: true });
    const building = screen.getByRole('region', { name: mn.common.regions.building3d });
    expect(within(building).getByText(mn.common.building3d.deferredNote)).toBeVisible();
    expect(
      within(building).getByRole('button', { name: mn.common.building3d.load }),
    ).toBeInTheDocument();
  });

  it('ажиллаж буй дохионы тоо «Дохио» табын нэрэнд', () => {
    renderPhone({ webgl: false });
    const count = createMockSnapshot().alerts.active.length;
    expect(count).toBeGreaterThan(0);
    expect(tab(tabs.alerts)).toHaveAccessibleName(`${tabs.alerts}, ${tabs.alertsCount(count)}`);
  });
});
