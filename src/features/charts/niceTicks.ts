// Хандлагын графикийн y тэнхлэгийн «дугуй» тэмдэглэгээ (D102): 674, 764… биш 700, 800… — уншихад хялбар.

/** Мужид багтах ойролцоогоор `target` ширхэг тэмдэглэгээ (алхам 1, 2, 2.5, 5 × 10ⁿ) */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ??
    10 * magnitude;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}
