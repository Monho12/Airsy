// UI тестийн setup (CLAUDE.md §9.3, D41): зөвхөн `ui` project ачаална. Domain тест үүнийг хэзээ ч ачаалахгүй.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
