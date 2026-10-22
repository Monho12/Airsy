import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatMetricValueMn, mn } from '@/domain/i18n/mn';
import type { Alert, LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot, MOCK_SAMPLE } from '@/store/mockSnapshot';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { App } from './App';

// Тест бүр цэвэр store-оос эхэлнэ (snapshot-гүй = ачаалж буй төлөв)
beforeEach(() => {
  useLiveStore.setState(initialLiveState, true);
  useUiStore.setState(initialUiState);
  // jsdom-д WebGL байхгүй (getContext → null) — «Not implemented» анхааруулгагүйгээр яг тэр байдлыг тогтооно.
  // Ингэснээр App нь WebGL-гүй хөтөч шиг 2D орлуулалт руу шилжинэ (§12.1, §12.2).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  return () => vi.restoreAllMocks();
});

const region = (name: string) => screen.getByRole('region', { name });
const floorOption = (level: number) =>
  screen.getByRole('option', { name: new RegExp(`^${floorLabelMn(level)}`) });

function renderWith(snapshot: LiveSnapshot = createMockSnapshot()) {
  applySnapshot(snapshot);
  return { user: userEvent.setup(), ...render(<App />) };
}

describe('App shell (smoke)', () => {
  it('AERIS нэр ба СИМУЛЯЦИ тэмдэгтэй зурагдана', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AERIS');
    expect(screen.getByText(mn.common.simulationBadge)).toBeInTheDocument();
  });

  it('§8.2-ын бүх хэсэг шошготой region болж зурагдана', () => {
    renderWith();
    for (const label of Object.values(mn.common.regions)) {
      expect(region(label)).toBeInTheDocument();
    }
  });

  it('товч, холбоос, оролт байхгүй — Phase 2-т төлөв өөрчлөх удирдлага хориотой (§8.7, §13)', () => {
    renderWith();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('хуудасны гарчиг Монгол хэлээр', () => {
    render(<App />);
    expect(document.title).toBe(mn.common.documentTitle);
  });
});

describe('Dashboard — ачаалж буй ба хоосон төлөв (§8.7)', () => {
  it('snapshot ирэхээс өмнө самбарууд «ачаалж байна» төлөвтэй', () => {
    render(<App />);
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(5);
    expect(region(mn.common.regions.floorList)).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('дохио ба үйл явдал байхгүй бол хоосон мессеж', () => {
    const snapshot = createMockSnapshot();
    renderWith({ ...snapshot, alerts: { active: [], recentResolved: [] }, events: [] });
    expect(within(region(mn.common.regions.alerts)).getByText(mn.alerts.emptyActive)).toBeVisible();
    expect(within(region(mn.common.regions.events)).getByText(mn.events.empty)).toBeVisible();
  });

  it('давхар сонгоогүй үед дэлгэрэнгүй ба төхөөрөмж зааварчилгаа харуулна', () => {
    renderWith();
    expect(
      within(region(mn.common.regions.floorDetails)).getByText(mn.common.noFloorSelected),
    ).toBeVisible();
    expect(
      within(region(mn.common.regions.devices)).getByText(mn.common.noFloorSelected),
    ).toBeVisible();
  });
});

describe('Dashboard — жишээ snapshot-оор', () => {
  it('төлөвийн мөр барилгын төлөв, идэвхтэй дохионы тоо, автомат горимыг Монголоор харуулна', () => {
    const snapshot = createMockSnapshot();
    renderWith(snapshot);
    const header = screen.getByRole('banner');
    expect(within(header).getByText(mn.common.buildingStatus)).toBeVisible();
    expect(within(header).getByText(mn.classification.statusLabel.warning)).toBeVisible();
    expect(within(header).getByText(mn.common.dataIssue)).toBeVisible();
    expect(
      within(header).getByText(mn.common.activeAlertCount(snapshot.alerts.active.length)),
    ).toBeVisible();
    expect(within(header).getByText(mn.control.autoModeOn)).toBeVisible();
  });

  it('давхрын жагсаалт тохиргооны бүх давхрыг дээрээс доош харуулна', () => {
    renderWith();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(buildingConfig.building.floorIds.length);
    expect(options[0]).toHaveTextContent(floorLabelMn(buildingConfig.building.floorIds.length));
    expect(options.at(-1)).toHaveTextContent(floorLabelMn(1));
  });

  it('өөр давхар сонгоход дэлгэрэнгүй шинэчлэгдэнэ', async () => {
    const { user } = renderWith();
    const details = region(mn.common.regions.floorDetails);

    await user.click(floorOption(2));
    expect(floorOption(2)).toHaveAttribute('aria-selected', 'true');
    expect(within(details).getByRole('heading', { level: 3 })).toHaveTextContent(
      `${floorLabelMn(2)} · ${buildingConfig.floors.F02!.name}`,
    );
    const co2 = formatMetricValueMn(MOCK_SAMPLE.warningValue, 'ppm', metricSpecs.co2.decimals);
    expect(within(details).getByText(co2)).toBeVisible();

    await user.click(floorOption(7));
    expect(floorOption(2)).toHaveAttribute('aria-selected', 'false');
    expect(within(details).getByRole('heading', { level: 3 })).toHaveTextContent(floorLabelMn(7));
    expect(within(details).queryByText(co2)).not.toBeInTheDocument();
  });

  it('холболтгүй мэдрэгч «Өгөгдөлгүй» гэж харагдана, хэзээ ч 0 биш (FR-M5)', async () => {
    const { user } = renderWith();
    await user.click(floorOption(4));
    const areaA = within(region(mn.common.regions.floorDetails)).getByRole('region', {
      name: buildingConfig.areas['F04-A']!.name,
    });
    const co2 = within(areaA).getByText(mn.metrics.label.co2).closest('[data-status]')!;
    expect(co2).toHaveAttribute('data-status', 'offline');
    expect(co2).toHaveTextContent(mn.common.noData);
    expect(co2).toHaveTextContent(mn.common.lastValue);
    expect(co2).not.toHaveTextContent(/(^|\D)0 ppm/);
  });

  it('гараар давхар сонгоно: ↑/↓, Home/End (§8.8)', async () => {
    const { user } = renderWith();
    const top = buildingConfig.building.floorIds.length;

    await user.tab();
    expect(floorOption(top)).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(floorOption(top - 1)).toHaveFocus();
    expect(floorOption(top - 1)).toHaveAttribute('aria-selected', 'true');
    expect(useUiStore.getState().selectedFloorId).toBe(buildingConfig.building.floorIds[top - 2]);

    await user.keyboard('{End}');
    expect(floorOption(1)).toHaveFocus();
    expect(floorOption(1)).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}'); // доод давхраас цааш явахгүй
    expect(floorOption(1)).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(floorOption(2)).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(floorOption(top)).toHaveFocus();
    expect(floorOption(top)).toHaveAttribute('aria-selected', 'true');
    expect(
      within(region(mn.common.regions.floorDetails)).getByRole('heading', { level: 3 }),
    ).toHaveTextContent(floorLabelMn(top));
  });

  it('сонгосон давхрын төхөөрөмж SF → EF → OAD дарааллаар, Монгол шошготой, зөвхөн харах', async () => {
    const { user } = renderWith();
    await user.click(floorOption(2));
    const devices = region(mn.common.regions.devices);
    const kinds = within(devices)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(kinds).toEqual([
      mn.devices.kind.supply_fan,
      mn.devices.kind.exhaust_fan,
      mn.devices.kind.outdoor_air_damper,
    ]);
    expect(within(devices).getAllByText(mn.devices.fanLevel.LOW)).toHaveLength(2);
    expect(within(devices).getByText(mn.devices.damperPosition.MINIMUM)).toBeVisible();
    expect(within(devices).getAllByText(mn.control.mode.auto)).toHaveLength(3);
    expect(within(devices).queryAllByRole('button')).toHaveLength(0);
  });

  it('ноцтой дохио эхэнд харагдана', () => {
    const snapshot = createMockSnapshot();
    const [first] = snapshot.alerts.active;
    // Хамгийн хуучин боловч ноцтой дохио — ноцтой байдал хугацаанаас түрүүлнэ
    const critical: Alert = {
      ...first!,
      id: 'A-9999',
      key: 'threshold:voc:F06',
      severity: 'critical',
      title: 'Ноцтой жишээ дохио',
      raisedAt: Math.min(...snapshot.alerts.active.map((alert) => alert.raisedAt)) - 60_000,
    };
    renderWith({
      ...snapshot,
      alerts: { ...snapshot.alerts, active: [...snapshot.alerts.active, critical] },
    });
    const items = within(region(mn.common.regions.alerts)).getAllByRole('listitem');
    expect(items).toHaveLength(snapshot.alerts.active.length + 1);
    expect(items[0]).toHaveTextContent(critical.title);
    expect(items[0]).toHaveTextContent(mn.alerts.severity.critical);
    expect(items[1]).toHaveTextContent(mn.alerts.severity.warning);
  });

  it('үйл явдал шинэ нь эхэнд, Монгол төрлийн шошготой', () => {
    const snapshot = createMockSnapshot();
    renderWith(snapshot);
    const items = within(region(mn.common.regions.events)).getAllByRole('listitem');
    expect(items).toHaveLength(snapshot.events.length);
    const newest = snapshot.events.at(-1)!;
    expect(items[0]).toHaveTextContent(mn.events.type[newest.type]);
    expect(items[0]).toHaveTextContent(newest.message);
    for (const item of items) expect(item.textContent).not.toMatch(/[A-Z]+_[A-Z]+/);
  });
});

describe('3D барилга — WebGL байхгүй үеийн орлуулалт (FR-B9, §8.6, §12.2)', () => {
  it('3D-ийн оронд тайлбар харуулж, 2D давхрын жагсаалт бүрэн ажиллана', async () => {
    const { user } = renderWith();
    const building = region(mn.common.regions.building3d);
    expect(within(building).getByRole('status')).toHaveTextContent(
      mn.common.building3d.fallback['webgl-unavailable'],
    );
    expect(within(building).queryByRole('img')).not.toBeInTheDocument();

    // Орлуулах харагдац = features/floor-list (FloorList өөрчлөгдөөгүй)
    await user.click(floorOption(7));
    expect(floorOption(7)).toHaveAttribute('aria-selected', 'true');
    expect(useUiStore.getState().selectedFloorId).toBe(buildingConfig.building.floorIds[6]);
  });
});

// UI тест jsdom орчинд, UI setup-тэй ажиллах ёстой (D41).
describe('ui тестийн орчин', () => {
  it('DOM ба jest-dom matcher ачаалагдсан', () => {
    expect(typeof document).toBe('object');
    expect('toBeInTheDocument' in expect(null)).toBe(true);
  });
});
