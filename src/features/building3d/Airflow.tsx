// Агаарын урсгалын шугам (CLAUDE.md §8.5, §8.6, §11.2, §11.3, FR-B8, D78, D84, D85): давхар бүрийн `airflowPaths`-ийн
// дагуу ~8 нимгэн муруй шугамын багц, supply → exhaust чиглэлд гүйх зөөлөн гэрлийн долгионтой (цэг, бөмбөлөг байхгүй).
// Өнгө зам дагуу `--color-accent` (цэвэр агаар) → `--color-text-secondary` (хэрэглэсэн агаар); яаралтай байдлын үед
// галын давхарт `--color-status-critical`. Шугамын тоо, тод байдал, долгионы хурд нь сэнсний урсгалтай пропорциональ;
// SF ба EF хоёулаа OFF бол харагдахгүй. Сонгосон давхар бүрэн тод, бусад ~30%.
// Нэг merged ribbon mesh + ShaderMaterial (1 draw call); өргөнийг vertex shader дэлгэцийн пикселээр тооцно.
// Frame бүрт зөвхөн давхрын uniform-ийг (≤ 20 тоо) шинэчилнэ — төлөвийг React биш `getState()`-ээс (§11.2).
// Хөдөлгөөн багасгах үед шугам хөдөлгөөнгүй, exhaust үзүүрт чиглэлийн сум (§8.5).
// Дүрслэл — агаарын урсгалын физик загвар биш.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  type Mesh,
  ShaderMaterial,
  Vector2,
} from 'three';

import type { BuildingConfig } from '@/domain/config/building';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

import {
  createAirflowLayout,
  createStreamlineData,
  floorAirflow,
  floorEmphasis,
  streamlineCount,
  STREAMLINE_STREAKS,
  streamlineStreakSpeed,
} from './animationData';
import { emergencyFloorRole } from './emergencyData';
import { isAboveSelected } from './selection';
import type { BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';

/** Шугамын өргөн, CSS пиксел (дүрслэлийн утга) */
const LINE_WIDTH_PX = 2;
/** Таб нуугдсаны дараах том delta-г хязгаарлана (долгион үсрэхгүй) */
const MAX_DELTA = 0.1;

const vertexShader = /* glsl */ `
  attribute vec3 aTangent;
  attribute float aSide;
  attribute float aAlong;
  attribute float aFloor;
  attribute float aSlot;
  attribute float aSeed;
  attribute float aKind;

  uniform vec2 uResolution;
  uniform float uWidth;
  uniform float uReduced;
  uniform float uCount[FLOOR_COUNT];
  uniform float uAirflow[FLOOR_COUNT];
  uniform float uEmphasis[FLOOR_COUNT];
  uniform float uPhase[FLOOR_COUNT];
  uniform float uFire[FLOOR_COUNT];

  varying float vAlong;
  varying float vSide;
  varying float vSeed;
  varying float vKind;
  varying float vVisible;
  varying float vAirflow;
  varying float vEmphasis;
  varying float vPhase;
  varying float vFire;

  void main() {
    int f = int(aFloor + 0.5);
    vAlong = aAlong;
    vSide = aSide;
    vSeed = aSeed;
    vKind = aKind;
    vAirflow = uAirflow[f];
    vEmphasis = uEmphasis[f];
    vPhase = uPhase[f];
    vFire = uFire[f];
    // Урсгалын шугам: slot < харагдах тоо; сум: зөвхөн хөдөлгөөн багасгах үед, урсгалтай давхарт
    float lineVisible = step(aSlot + 0.5, uCount[f]);
    float arrowVisible = step(0.5, uCount[f]) * uReduced;
    vVisible = mix(lineVisible, arrowVisible, aKind);

    // Дэлгэцийн пикселээр тогтмол өргөн: шүргэгчийн дэлгэцэн дээрх чиглэлд перпендикуляр шилжүүлнэ
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 ahead = projectionMatrix * modelViewMatrix * vec4(position + aTangent * 0.25, 1.0);
    vec2 a = clip.xy / clip.w * uResolution;
    vec2 b = ahead.xy / ahead.w * uResolution;
    vec2 dir = b - a;
    float len = length(dir);
    dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);
    clip.xy += normal * aSide * uWidth / uResolution * clip.w;
    gl_Position = clip;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSupplyColor;
  uniform vec3 uExhaustColor;
  uniform vec3 uFireColor;
  uniform float uReduced;

  varying float vAlong;
  varying float vSide;
  varying float vSeed;
  varying float vKind;
  varying float vVisible;
  varying float vAirflow;
  varying float vEmphasis;
  varying float vPhase;
  varying float vFire;

  void main() {
    if (vVisible < 0.5) discard;
    // Хоёр үзүүр бүдгэрнэ (сумд хамаарахгүй); туузны ирмэг зөөлөн
    float ends = smoothstep(0.0, 0.14, vAlong) * (1.0 - smoothstep(0.84, 1.0, vAlong));
    ends = mix(ends, 1.0, vKind);
    float across = 1.0 - smoothstep(0.35, 1.0, abs(vSide));

    // Гэрлийн зураас (шугам бүрт STREAKS ширхэг): урт бүдгэрэх сүүл, тод хурц толгой — supply → exhaust чиглэлд
    // салхи мэт гүйнэ. Фаз нь зам дагуух хувиар; зураас бүр зам дагуу 1/STREAKS зайтай.
    float wave = 0.0;
    if (uReduced < 0.5) {
      float x = fract((vAlong - vPhase) * STREAKS + vSeed);
      wave = smoothstep(0.0, 0.42, x) * (1.0 - smoothstep(0.42, 0.5, x));
      wave *= wave;
    }

    vec3 color = mix(uSupplyColor, uExhaustColor, smoothstep(0.1, 0.9, vAlong));
    color = mix(color, uFireColor, vFire);
    color += wave * 0.6;

    // Хөдлөхгүй суурь шугам бүдэг, хөдөлж буй зураас тод — хөдөлгөөн тод мэдрэгдэнэ
    float lineAlpha = 0.2 + 0.25 * vAirflow + 1.1 * wave * (0.6 + 0.4 * vAirflow);
    float alpha = vEmphasis * ends * across * mix(lineAlpha, 0.8, vKind);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function Airflow({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const invalidate = useThree((state) => state.invalidate);
  const floors = useMemo(() => createAirflowLayout(config, layout), [config, layout]);
  const floorCount = Math.max(1, floors.length);

  const geometry = useMemo(() => {
    const data = createStreamlineData(floors);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.position, 3));
    g.setAttribute('aTangent', new BufferAttribute(data.tangent, 3));
    g.setAttribute('aSide', new BufferAttribute(data.side, 1));
    g.setAttribute('aAlong', new BufferAttribute(data.along, 1));
    g.setAttribute('aFloor', new BufferAttribute(data.floor, 1));
    g.setAttribute('aSlot', new BufferAttribute(data.slot, 1));
    g.setAttribute('aSeed', new BufferAttribute(data.seed, 1));
    g.setAttribute('aKind', new BufferAttribute(data.kind, 1));
    g.setIndex(new BufferAttribute(data.index, 1));
    return g;
  }, [floors]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        defines: { FLOOR_COUNT: floorCount, STREAKS: `${STREAMLINE_STREAKS}.0` },
        uniforms: {
          uResolution: { value: new Vector2(1, 1) },
          uWidth: { value: LINE_WIDTH_PX },
          uReduced: { value: 0 },
          uCount: { value: new Array<number>(floorCount).fill(0) },
          uAirflow: { value: new Array<number>(floorCount).fill(0) },
          uEmphasis: { value: new Array<number>(floorCount).fill(0) },
          uPhase: { value: new Array<number>(floorCount).fill(0) },
          uFire: { value: new Array<number>(floorCount).fill(0) },
          uSupplyColor: { value: new Color(colors.selected) },
          uExhaustColor: { value: new Color(colors.airflow) },
          uFireColor: { value: new Color(colors.status.critical) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // Туузны гурвалжны эргэлт дэлгэцэн дээрх чиглэлээс хамаарна — хоёр талыг зурна (culling-д хасагдахгүй)
        side: DoubleSide,
      }),
    [floorCount, colors],
  );

  // R3F-д JSX-ээр бус дамжуулсан объектыг өөрсдөө чөлөөлнө (§11.3)
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // `frameloop="demand"`: хөдөлгөөн багасгах үед frame тасралтгүй хүсэхгүй тул төлөв/сонголт өөрчлөгдөхөд дахин зурна
  useEffect(() => {
    const unsubscribeLive = useLiveStore.subscribe(() => invalidate());
    const unsubscribeUi = useUiStore.subscribe(() => invalidate());
    return () => {
      unsubscribeLive();
      unsubscribeUi();
    };
  }, [invalidate]);

  // Uniform-ийг mesh-ийн ref-ээр өөрчилнө (hook-ийн утгыг шууд өөрчлөхгүй — react-hooks/immutability)
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    const u = (mesh.material as ShaderMaterial).uniforms;
    const snapshot = useLiveStore.getState().snapshot;
    const devices = snapshot?.devices ?? null;
    const emergency = snapshot?.control.emergency ?? null;
    const selectedFloorId = useUiStore.getState().selectedFloorId;
    const dt = Math.min(delta, MAX_DELTA);
    const counts = u.uCount!.value as number[];
    const airflows = u.uAirflow!.value as number[];
    const emphasis = u.uEmphasis!.value as number[];
    const phases = u.uPhase!.value as number[];
    const fire = u.uFire!.value as number[];
    let moving = false;
    floors.forEach((floor, f) => {
      // Сонгосон давхрын дээрх давхрын урсгал нуугдана (D88)
      const airflow = isAboveSelected(floor.floorId, selectedFloorId)
        ? 0
        : floorAirflow(devices, config, floor.floorId);
      counts[f] = streamlineCount(airflow);
      airflows[f] = airflow;
      emphasis[f] = floorEmphasis(floor.floorId, selectedFloorId);
      fire[f] = emergencyFloorRole(floor.floorId, emergency, config) === 'fire' ? 1 : 0;
      if (!reducedMotion && airflow > 0) {
        phases[f] = ((phases[f] ?? 0) + dt * streamlineStreakSpeed(airflow)) % 1;
        moving = true;
      }
    });
    (u.uResolution!.value as Vector2).set(state.size.width, state.size.height);
    u.uReduced!.value = reducedMotion ? 1 : 0;
    // Долгион гүйж байвал дараагийн frame-ийг хүснэ
    if (moving) state.invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      // Сонгогдохгүй — мэдрэгч/давхрын click-ийг саадгүй (raycast-гүй)
      raycast={() => null}
      // Орой shader-т шилжинэ — bounding sphere-ээр тайрахгүй
      frustumCulled={false}
      renderOrder={10}
    />
  );
}
