import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { floorLabelMn, formatMetricValueMn, formatNumberMn, mn } from '@/domain/i18n/mn';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { selectFloorSummary } from '@/store/selectors';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { FloorList } from './FloorList';

// jsdom layout тооцдоггүй ба scrollIntoView-гүй: дуудлагыг бүртгэж, «харагдуулах» хүсэлтийг шалгана.
// Бодит гүйлгэлтийг (max-height, overflow) браузерт шалгана.
let revealed: { element: Element; options: unknown }[] = [];

beforeEach(() => {
  useLiveStore.setState(initialLiveState, true);
  useUiStore.setState(initialUiState);
  revealed = [];
  Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
    revealed.push({ element: this, options });
  };
});

afterEach(() => {
  // @ts-expect-error — jsdom-ийн анхны төлөв рүү буцаана (method байхгүй)
  delete Element.prototype.scrollIntoView;
});

const floorCount = buildingConfig.building.floorIds.length;
const option = (level: number) =>
  screen.getByRole('option', { name: new RegExp(`^${floorLabelMn(level)}`) });

function renderList() {
  applySnapshot(createMockSnapshot());
  return { user: userEvent.setup(), ...render(<FloorList />) };
}

describe('FloorList — гүйлгэх жагсаалт', () => {
  it('гүйлгэх хэсэг нь зөвхөн давхрын мөрүүдийг агуулсан нэг listbox', () => {
    renderList();
    const listbox = screen.getByRole('listbox', { name: mn.common.regions.floorList });
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(floorCount);
    expect(listbox.children).toHaveLength(floorCount); // заавар бичвэр гүйлгэх хэсгээс гадна
    expect(listbox).toHaveAccessibleDescription(mn.common.floorListHint);
  });

  it('мөр бүрт давхрын дугаар, нэр, төлөв харагдана', () => {
    renderList();
    const f02 = option(2);
    expect(f02).toHaveTextContent(buildingConfig.floors.F02!.name);
    expect(f02).toHaveTextContent(mn.classification.statusLabel.warning);
  });

  it('гарын удирдлагаар focus үргэлж харагдах option дээр, roving tabindex нэг л мөрөнд', async () => {
    const { user } = renderList();
    const listbox = screen.getByRole('listbox');

    await user.tab();
    expect(option(floorCount)).toHaveFocus();

    for (let level = floorCount - 1; level >= 1; level -= 1) {
      await user.keyboard('{ArrowDown}');
      const focused = document.activeElement as HTMLElement;
      expect(focused).toBe(option(level));
      expect(focused).toHaveAttribute('aria-selected', 'true');
      // Focus-тэй мөрийг гүйлгэх хэсэгт харагдуулах хүсэлт ('nearest' — шаардлагагүй үсрэлтгүй)
      expect(revealed.at(-1)).toEqual({ element: focused, options: { block: 'nearest' } });
      const tabbable = within(listbox)
        .getAllByRole('option')
        .filter((row) => row.tabIndex === 0);
      expect(tabbable).toEqual([focused]);
    }

    await user.keyboard('{Home}');
    expect(option(floorCount)).toHaveFocus();
    expect(revealed.at(-1)?.element).toBe(option(floorCount));
  });

  it('Enter ба Space сонгоно', async () => {
    const { user } = renderList();
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    useUiStore.getState().selectFloor(null);
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().selectedFloorId).toBe(
      buildingConfig.building.floorIds[floorCount - 3],
    );
    useUiStore.getState().selectFloor(null);
    await user.keyboard(' ');
    expect(useUiStore.getState().selectedFloorId).toBe(
      buildingConfig.building.floorIds[floorCount - 3],
    );
  });

  it('focus жагсаалтад баригдахгүй: Tab гаргаж, Shift+Tab сонгосон мөр рүү буцаана', async () => {
    const { user } = renderList();
    const listbox = screen.getByRole('listbox');

    await user.tab();
    await user.keyboard('{End}');
    expect(option(1)).toHaveFocus();

    await user.tab();
    expect(listbox).not.toContainElement(document.activeElement as HTMLElement);

    await user.tab({ shift: true });
    expect(option(1)).toHaveFocus();
  });

  it('сонголт гаднаас өөрчлөгдөхөд (жишээ нь 3D) тэр давхрыг харагдуулна', () => {
    renderList();
    act(() => useUiStore.getState().selectFloor('F03'));
    expect(option(3)).toHaveAttribute('aria-selected', 'true');
    expect(revealed.at(-1)).toEqual({ element: option(3), options: { block: 'nearest' } });
  });
});

describe('FloorList — нягт мөр (D100)', () => {
  it('мөр бүрт CO₂ ба температурын давхрын хамгийн их утга; зөв хэмжилтгүй бол «Өгөгдөлгүй»', () => {
    const snapshot = createMockSnapshot();
    const summary = selectFloorSummary(snapshot, 'F07')!;
    renderList();
    const row = option(7);
    expect(row).toHaveTextContent(`CO₂ ${formatNumberMn(summary.aggregates.co2!.max, 0)}`);
    expect(row).toHaveTextContent(
      formatMetricValueMn(summary.aggregates.temperature!.max, '°C', 1),
    );
    expect(row).not.toHaveTextContent(/CO₂ 0(?!\d)/);
    // Нягт төлөвийн тэмдэг: бичвэр дэлгэц уншигчид хэвээр (§8.3)
    expect(row).toHaveTextContent(mn.classification.statusLabel.normal);
  });
});
