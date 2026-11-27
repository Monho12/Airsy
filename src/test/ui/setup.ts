// UI тестийн setup (CLAUDE.md §9.3, D41): зөвхөн `ui` project ачаална. Domain тест үүнийг хэзээ ч ачаалахгүй.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Тест жинхэнэ сүлжээ рүү хэзээ ч явахгүй: анхдагч `fetch` хэзээ ч хариулахгүй (D105-ийн ServerStatus
// «шалгаж байна» төлөвтөө үлдэнэ). Сүлжээ шалгах тест өөрөө `vi.stubGlobal('fetch', …)` хийнэ.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
