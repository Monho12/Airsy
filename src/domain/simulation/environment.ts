// Бүсийн орчны 1-р эрэмбийн загвар (CLAUDE.md §5.8) ба тэнцвэрийн тохируулга (D68).
// Цэвэр функцууд: ижил оролт → ижил гаралт. Шуугиан энд нэмэгдэхгүй — зөвхөн мэдрэгчийн илгээж буй утгад (D69).
import { OUTDOOR_BASELINE } from '@/domain/config/building';
import { baselineDeviceStates, damperOutdoorFraction, fanAirflow } from '@/domain/config/control';
import { simulationModel } from '@/domain/config/simulation';
import { outdoorAirThresholds } from '@/domain/config/thresholds';
import type { Area, DeviceKind, DeviceState, MetricType } from '@/domain/types';

export type SimulationModel = typeof simulationModel;

/** Бүсийн дотоод төлөв (шуугиангүй) */
export type AreaEnvironment = Record<MetricType, number>;

/** Гадна нөхцөл. CO₂ нь мэдрэгч биш, тохиргооны тогтмол (§5.3). */
export interface OutdoorEnvironment {
  temperature: number;
  humidity: number;
  pm25: number;
  co2: number;
}

/** S1-ийн гадна нөхцөл (§7.2) — тохируулгын лавлах цэг (D68) */
export const baselineOutdoor: OutdoorEnvironment = {
  ...OUTDOOR_BASELINE,
  co2: outdoorAirThresholds.outdoorCo2Ppm,
};

/** §5.8: outdoorAirRate, exhaustRate, filtrationRate (с⁻¹) */
export interface VentilationRates {
  outdoorAir: number;
  exhaust: number;
  filtration: number;
}

/** Бүс бүрийн суурь эх үүсвэр (D68): суурь нөхцөлд тэнцвэр = `Area.baseline` */
export interface AreaCalibration {
  /** g_co2 (бүсээр), ppm·м³/(хүн·с) */
  co2PerOccupant: number;
  vocBaseline: number;
  /** pmSource₀, µg/m³/с */
  pmSource: number;
  /** heatGain₀, °C/с (`thermalMass = 1`) */
  heatGain: number;
  setpoint: number;
  /**
   * moistureSource₀, %RH/с. Сөрөг байж болно (дотор гаднаас хуурай) — зөвхөн математик тохируулгын гишүүн, чийг
   * бууруулах төхөөрөмжийн загвар БИШ (D68-ийн 3, §2.2).
   */
  moistureSource: number;
}

const fanFlow = (state: DeviceState) =>
  state.kind === 'outdoor_air_damper' ? 0 : fanAirflow[state.level];
const damperFraction = (state: DeviceState) =>
  state.kind === 'outdoor_air_damper' ? damperOutdoorFraction[state.position] : 0;

/** Давхрын төхөөрөмжийн төлөвөөс агааржуулалтын хурд (§5.8) */
export function ventilationRates(
  devices: Readonly<Record<DeviceKind, DeviceState>>,
  model: SimulationModel = simulationModel,
): VentilationRates {
  const supply = fanFlow(devices.supply_fan);
  const exhaust = fanFlow(devices.exhaust_fan);
  const outdoorFraction = damperFraction(devices.outdoor_air_damper);
  return {
    outdoorAir: model.kOutdoorAir * supply * outdoorFraction,
    exhaust: model.kExhaust * exhaust,
    filtration: model.kFiltration * supply * (1 - outdoorFraction),
  };
}

/** Суурь ачааллын хүний тоо (§5.8: occupancyCapacity × baselineOccupancy) */
export const baselineOccupants = (area: Area) => area.occupancyCapacity * area.baselineOccupancy;

/**
 * Бүсийн суурь эх үүсвэрийг тооцно (D68): суурь ачаалал, суурь төхөөрөмж (SF LOW, EF LOW, OAD MINIMUM) ба
 * S1-ийн гадна нөхцөлд §5.8-ын тэгшитгэлийн тэнцвэр яг `Area.baseline` болно.
 */
export function calibrateArea(
  area: Area,
  model: SimulationModel = simulationModel,
  outdoor: OutdoorEnvironment = baselineOutdoor,
): AreaCalibration {
  const rates = ventilationRates(baselineDeviceStates, model);
  const occupants = baselineOccupants(area);
  const base = area.baseline;
  if (occupants <= 0 && base.co2 !== outdoor.co2) {
    throw new Error(
      `Бүс ${area.id}: суурь ачаалалгүй тул CO₂-ийн эх үүсвэрийг тохируулах боломжгүй`,
    );
  }
  const outdoorPassing = rates.outdoorAir * (1 - model.filterEfficiency);
  return {
    co2PerOccupant:
      occupants > 0
        ? ((base.co2 - outdoor.co2) * (rates.outdoorAir + rates.exhaust) * area.volumeM3) /
          occupants
        : 0,
    vocBaseline: base.voc,
    pmSource: base.pm25 * (outdoorPassing + rates.filtration) - outdoorPassing * outdoor.pm25,
    heatGain: model.thermalMass * rates.outdoorAir * (base.temperature - outdoor.temperature),
    setpoint: base.temperature,
    moistureSource: model.humidityCoupling * rates.outdoorAir * (base.humidity - outdoor.humidity),
  };
}

export interface AreaStepInput {
  state: AreaEnvironment;
  calibration: AreaCalibration;
  rates: VentilationRates;
  occupants: number;
  volumeM3: number;
  outdoor: OutdoorEnvironment;
  /** Алхмын урт, секунд (§5.8: dt = 1 с) */
  dtSec: number;
  /** Сценарийн нэмэлт эх үүсвэр (§5.8: `heatGain(t)`, `vocSource(t)`, `pmSource(t)`); анхдагч 0 */
  extra?: ScenarioSources;
}

/** Суурь (тохируулсан) эх үүсвэр дээр нэмэгдэх сценарийн оролт (§5.8, D68-ийн 2) */
export interface ScenarioSources {
  /** °C/с */
  heatGain: number;
  /** VOC индекс/с */
  vocSource: number;
  /** µg/m³/с */
  pmSource: number;
}

export const NO_EXTRA_SOURCES: ScenarioSources = { heatGain: 0, vocSource: 0, pmSource: 0 };

/**
 * §5.8-ын нэг алхам (тодорхой Euler). Тохируулсан суурь эх үүсвэр (D68) дээр сценарийн нэмэлт эх үүсвэр (`extra`)
 * нэмэгдэнэ.
 */
export function stepAreaEnvironment(
  {
    state,
    calibration: c,
    rates,
    occupants,
    volumeM3,
    outdoor,
    dtSec: dt,
    extra = NO_EXTRA_SOURCES,
  }: AreaStepInput,
  model: SimulationModel = simulationModel,
): AreaEnvironment {
  const dilution = rates.outdoorAir + rates.exhaust;
  return {
    co2:
      state.co2 +
      dt * ((c.co2PerOccupant * occupants) / volumeM3 - dilution * (state.co2 - outdoor.co2)),
    voc: state.voc + dt * (extra.vocSource - dilution * (state.voc - c.vocBaseline)),
    pm25:
      state.pm25 +
      dt *
        (rates.outdoorAir * (outdoor.pm25 - state.pm25) * (1 - model.filterEfficiency) -
          rates.filtration * state.pm25 +
          c.pmSource +
          extra.pmSource),
    temperature:
      state.temperature +
      dt *
        ((c.heatGain + extra.heatGain) / model.thermalMass -
          rates.outdoorAir * (state.temperature - outdoor.temperature) -
          model.hvacRecovery * (state.temperature - c.setpoint)),
    humidity:
      state.humidity +
      dt *
        (c.moistureSource -
          rates.outdoorAir * (state.humidity - outdoor.humidity) * model.humidityCoupling),
  };
}
