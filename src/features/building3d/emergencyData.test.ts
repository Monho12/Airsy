// Яаралтай байдлын 3D тодруулгын давхрын үүрэг (§6.9, §7.2 S6, D83).
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';

import { emergencyFloorRole } from './emergencyData';

const emergency = { fireFloorId: 'F08', startedAt: 0 };

describe('emergencyFloorRole', () => {
  it('яаралтай байдалгүй үед үүрэггүй', () => {
    expect(emergencyFloorRole('F08', null, buildingConfig)).toBeNull();
  });

  it('галын давхар, яг дээд/доод давхар — хөрш, бусад — үүрэггүй', () => {
    expect(emergencyFloorRole('F08', emergency, buildingConfig)).toBe('fire');
    expect(emergencyFloorRole('F07', emergency, buildingConfig)).toBe('neighbor');
    expect(emergencyFloorRole('F09', emergency, buildingConfig)).toBe('neighbor');
    expect(emergencyFloorRole('F06', emergency, buildingConfig)).toBeNull();
    expect(emergencyFloorRole('F12', emergency, buildingConfig)).toBeNull();
  });

  it('тохиргоонд байхгүй галын давхарт хөрш тооцохгүй', () => {
    const small = createBuildingConfig(6);
    expect(emergencyFloorRole('F06', emergency, small)).toBeNull();
  });
});
