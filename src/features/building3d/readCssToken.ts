// Дизайны токеныг CSS хувьсагчаас уншина (CLAUDE.md §8.3, D57) — 3D ба 2D UI нэг эх сурвалжтай, hex хатуу бичихгүй.

/** Токен олдохгүй бол алдаа шиднэ: дуугүй хар өнгө зурахын оронд error boundary орлуулалт руу шилжүүлнэ. */
export function readCssToken(
  name: `--${string}`,
  element: Element = document.documentElement,
): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  if (value === '') throw new Error(`CSS токен олдсонгүй: ${name}`);
  return value;
}
