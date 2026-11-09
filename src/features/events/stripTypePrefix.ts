/**
 * Мессеж төрлийн шошгоор эхэлбэл («Сценарийн алхам: …») давхар бичихгүй — шошго дээр аль хэдийн харагдана (D102).
 * Domain-ийн мессеж (түүх) өөрчлөгдөхгүй, зөвхөн харагдац.
 */
export function stripTypePrefix(message: string, typeLabel: string): string {
  const prefix = `${typeLabel}: `;
  return message.startsWith(prefix) && message.length > prefix.length
    ? message.slice(prefix.length)
    : message;
}
