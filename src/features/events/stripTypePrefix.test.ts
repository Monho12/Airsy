import { describe, expect, it } from 'vitest';

import { stripTypePrefix } from './stripTypePrefix';

describe('stripTypePrefix (D102)', () => {
  it('төрлийн шошгоор эхэлсэн мессежээс давхардлыг хасна', () => {
    expect(stripTypePrefix('Сценарийн алхам: Их танхимд хурал эхэлнэ', 'Сценарийн алхам')).toBe(
      'Их танхимд хурал эхэлнэ',
    );
  });
  it('бусад мессеж хэвээр', () => {
    expect(stripTypePrefix('Агаар оруулах сэнс F02: Бага → Их', 'Төхөөрөмжийн төлөв')).toBe(
      'Агаар оруулах сэнс F02: Бага → Их',
    );
    expect(stripTypePrefix('Сценарийн алхам: ', 'Сценарийн алхам')).toBe('Сценарийн алхам: ');
  });
});
