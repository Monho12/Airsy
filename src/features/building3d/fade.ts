// Тунгалаг байдал/масштабын зөөлөн шилжилт (D94): сонголт солигдоход (ялангуяа цуцлахад) давхрын хавтан, бүс,
// мэдрэгчийн зангилаа нэг кадрт «пид» гэж солигдохгүй, ~0.3 с-д зөөлөн шилжинэ. Хөдөлгөөн багасгах үед шууд (§8.5).
// `frameloop="demand"` тул шилжилт дуустал л `invalidate()`-ээр кадр хүснэ.
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, useState } from 'react';
import { MathUtils, type Material } from 'three';

import { useUiStore } from '@/store/uiStore';

/** Зөөлрүүлэлтийн хурд (λ, 1/с): 95% нь ≈ 0.25 с-д */
export const FADE_LAMBDA = 12;
/** Хүрсэн гэж үзэх зөрүү */
export const FADE_EPSILON = 0.002;
/** Сул зогсолтын дараах эхний кадрын delta-г хязгаарлана (үсрэлтгүй) */
const MAX_DELTA = 1 / 30;

/** Нэг алхам: `current` → `target`; хүрсэн бол яг `target` ба `done` */
export function fadeStep(
  current: number,
  target: number,
  delta: number,
): { value: number; done: boolean } {
  if (Math.abs(target - current) <= FADE_EPSILON) return { value: target, done: true };
  const value = MathUtils.damp(current, target, FADE_LAMBDA, Math.min(delta, MAX_DELTA));
  if (Math.abs(target - value) <= FADE_EPSILON) return { value: target, done: true };
  return { value, done: false };
}

/**
 * Материалын `opacity`-г `target` руу зөөлөн шилжүүлнэ. Буцаасан ref-ийг материалд өгч, JSX-д `opacity` prop
 * ӨГӨХГҮЙ (R3F prop-ийг дахин тавьж шилжилтийг таслахгүйн тулд) — эхний утгыг (`from`) hook mount үед тавина.
 * `onSettled` — зорилтод хүрэх бүрт.
 */
export function useOpacityFade<T extends Material>(
  target: number,
  onSettled?: () => void,
  /** Эхлэх opacity (анхдагч — зорилт өөрөө, шилжилтгүй) */
  from: number = target,
) {
  const ref = useRef<T>(null);
  const [initial] = useState(from);
  // Эхний opacity — материал үүссэний дараа, анхны зурахаас өмнө
  useLayoutEffect(() => {
    if (ref.current !== null) ref.current.opacity = initial;
  }, [initial]);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const invalidate = useThree((state) => state.invalidate);
  const settledRef = useRef(true);

  useLayoutEffect(() => {
    settledRef.current = false;
    invalidate();
  }, [target, invalidate]);

  useFrame((_, delta) => {
    const material = ref.current;
    if (material === null || settledRef.current) return;
    const { value, done } = reducedMotion
      ? { value: target, done: true }
      : fadeStep(material.opacity, target, delta);
    material.opacity = value;
    if (done) {
      settledRef.current = true;
      onSettled?.();
    } else {
      invalidate();
    }
  });

  return ref;
}
