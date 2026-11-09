// Орчны (ambient) анимацийн frame-ийн хязгаар (D104). Сэнсний эргэлт ба агаарын урсгалын долгион тасралтгүй хөдөлдөг
// тул `frameloop="demand"` үед ч frame бүрт `invalidate()` дуудвал canvas дэлгэцийн давтамжаар (60–144 Hz) байнга
// зурагдаж CPU-г дүүргэнэ. Эдгээр нь чимэглэлийн хөдөлгөөн тул ~30 fps хангалттай: хүсэлтийг нэг таймерт нэгтгэж,
// хамгийн ихдээ `AMBIENT_FRAME_MS` тутамд нэг frame хүснэ. Хэрэглэгчийн үйлдэл (эргүүлэх, ойртуулах), камерын
// шилжилт, сонголтын бүдгэрэлт хязгааргүй хэвээр (тэд `invalidate()`-ийг шууд дууддаг).

/** ~30 fps */
export const AMBIENT_FRAME_MS = 33;

export interface AmbientScheduler {
  /** Дараагийн орчны frame-ийг хүснэ — аль хэдийн хүссэн бол юу ч хийхгүй */
  request(): void;
  /** Хүлээгдэж буй хүсэлтийг цуцална */
  cancel(): void;
}

/**
 * `now` ба `schedule` нь тестэд солигдоно. Хоёр хүсэлтийн хоорондох хугацааг (frame зурах хугацаа орно)
 * `intervalMs`-ээс богиносгохгүй.
 */
export function createAmbientScheduler(
  invalidate: () => void,
  intervalMs = AMBIENT_FRAME_MS,
  now: () => number = () => performance.now(),
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  clear: (id: ReturnType<typeof setTimeout>) => void = clearTimeout,
): AmbientScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastFiredAt = -Infinity;
  return {
    request() {
      if (timer !== null) return;
      const wait = Math.max(0, intervalMs - (now() - lastFiredAt));
      timer = schedule(() => {
        timer = null;
        lastFiredAt = now();
        invalidate();
      }, wait);
    },
    cancel() {
      if (timer !== null) clear(timer);
      timer = null;
    },
  };
}

// Нэг canvas-ийн (нэг `invalidate`) бүх орчны анимаци нэг таймерыг хуваалцана
const schedulers = new WeakMap<() => void, { scheduler: AmbientScheduler; users: number }>();

/** `invalidate`-д харгалзах нийтлэг scheduler-ийг авна; буцаах функц нь хэрэглэгчийг чөлөөлнө */
export function acquireAmbientScheduler(invalidate: () => void): [AmbientScheduler, () => void] {
  let entry = schedulers.get(invalidate);
  if (entry === undefined) {
    entry = { scheduler: createAmbientScheduler(invalidate), users: 0 };
    schedulers.set(invalidate, entry);
  }
  entry.users += 1;
  const current = entry;
  return [
    current.scheduler,
    () => {
      current.users -= 1;
      if (current.users === 0) {
        current.scheduler.cancel();
        schedulers.delete(invalidate);
      }
    },
  ];
}
