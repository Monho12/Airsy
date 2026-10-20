// CLAUDE.md §9.3-ын 8-р дүрэм: архитектурын хил ба deterministic хориг бүрийг зориуд зөрчсөн жишээгээр шалгана.
// Түр файл үүсгэхгүй — ESLint API-аар (`lintText` + `filePath`) fixture модны дотор байгаа мэт кодыг lint хийнэ.
// Импортын зорилтот файлууд tooling/fixtures/boundaries/src/-д бодитоор байдаг (resolver тэдгээрийг олох ёстой).
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureSrc = `${repoRoot}tooling/fixtures/boundaries/src/`;
const eslint = new ESLint({ cwd: repoRoot });

/** `relativePath` нь fixture-ийн src-ээс; `base`-ээр өөр үндэс (жишээ нь repo-ийн үндэс) өгч болно. */
async function lint(relativePath: string, code: string, base = fixtureSrc) {
  const [result] = await eslint.lintText(code, { filePath: `${base}${relativePath}` });
  if (!result) throw new Error('ESLint үр дүн буцаасангүй');
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`Задлан шинжилгээний алдаа: ${fatal[0]!.message}`);
  return result.messages;
}

type Case = { name: string; file: string; code: string; rule: string };

const violations: Case[] = [
  // ---------- Давхаргын хил (2-р дүрэм) ----------
  {
    name: 'domain → react',
    file: 'domain/control/bad.ts',
    code: "import { useState } from 'react';\nexport const value = useState;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'domain → store',
    file: 'domain/control/bad.ts',
    code: "import { fixtureStore } from '@/store/uiStore';\nexport const value = fixtureStore;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'feature → өөр feature-ийн дотоод файл',
    file: 'features/alpha/bad.ts',
    code: "import { fixtureBetaInternal } from '@/features/beta/internal';\nexport const value = fixtureBetaInternal;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'feature → өөр feature-ийн index',
    file: 'features/alpha/bad.ts',
    code: "import { fixtureBeta } from '@/features/beta';\nexport const value = fixtureBeta;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'feature → domain/control',
    file: 'features/alpha/bad.ts',
    code: "import { fixtureEngine } from '@/domain/control/engine';\nexport const value = fixtureEngine;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'feature → LocalSimulationRuntime',
    file: 'features/alpha/bad.ts',
    code: "import { fixtureLocalRuntime } from '@/domain/runtime/LocalSimulationRuntime';\nexport const value = fixtureLocalRuntime;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'store → LocalSimulationRuntime',
    file: 'store/bad.ts',
    code: "import { fixtureLocalRuntime } from '@/domain/runtime/LocalSimulationRuntime';\nexport const value = fixtureLocalRuntime;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'components/ui → store',
    file: 'components/ui/Bad.ts',
    code: "import { fixtureStore } from '@/store/uiStore';\nexport const value = fixtureStore;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'app → feature-ийн дотоод файл',
    file: 'app/Bad.ts',
    code: "import { fixtureAlphaInternal } from '@/features/alpha/internal';\nexport const value = fixtureAlphaInternal;\n",
    rule: 'boundaries/dependencies',
  },

  // ---------- Харьцангуй импортын хэлбэр (1-р дүрэм) ----------
  {
    name: 'дээд хавтас хоорондын харьцангуй `../` импорт',
    file: 'store/bad.ts',
    code: "import { fixtureTypes } from '../domain/types';\nexport const value = fixtureTypes;\n",
    rule: 'no-restricted-imports',
  },

  // ---------- Тестийн үл хамаарал (2-р дүрэм) ----------
  {
    name: 'тест бус domain файл → vitest',
    file: 'domain/control/bad.ts',
    code: "import { expect } from 'vitest';\nexport const value = expect;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'тест бус store файл → vitest',
    file: 'store/bad.ts',
    code: "import { expect } from 'vitest';\nexport const value = expect;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'тест бус store файл → src/test/ui',
    file: 'store/bad.ts',
    code: "import { fixtureUiRender } from '@/test/ui/render';\nexport const value = fixtureUiRender;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'domain тест → @testing-library/react',
    file: 'domain/control/bad.test.ts',
    code: "import { render } from '@testing-library/react';\nexport const value = render;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'domain тест → src/test/ui',
    file: 'domain/control/bad.test.ts',
    code: "import { fixtureUiRender } from '@/test/ui/render';\nexport const value = fixtureUiRender;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'src/test/domain → store',
    file: 'test/domain/bad.ts',
    code: "import { fixtureStore } from '@/store/uiStore';\nexport const value = fixtureStore;\n",
    rule: 'boundaries/dependencies',
  },

  // ---------- Deterministic domain (3-р дүрэм) ----------
  {
    name: 'domain-д Date.now()',
    file: 'domain/control/bad.ts',
    code: 'export const now = Date.now();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'domain-д Math.random()',
    file: 'domain/control/bad.ts',
    code: 'export const roll = Math.random();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'domain-д performance.now()',
    file: 'domain/control/bad.ts',
    code: 'export const tick = performance.now();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'domain-д аргументгүй new Date()',
    file: 'domain/control/bad.ts',
    code: 'export const today = new Date();\n',
    rule: 'no-restricted-syntax',
  },
  {
    name: 'domain-д setTimeout',
    file: 'domain/control/bad.ts',
    code: 'export const handle = setTimeout(() => undefined, 10);\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'domain-д window',
    file: 'domain/control/bad.ts',
    code: 'export const width = window.innerWidth;\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'domain тестэд Math.random()',
    file: 'domain/control/bad.test.ts',
    code: 'export const roll = Math.random();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'src/test/domain-д Date.now()',
    file: 'test/domain/bad.ts',
    code: 'export const now = Date.now();\n',
    rule: 'no-restricted-properties',
  },
  // ---------- React (.tsx) — tsx-ийн тохиргоо бодитоор ачаалагдаж буйг шалгана ----------
  {
    name: 'нөхцөл дотор hook дуудах (.tsx)',
    file: 'components/ui/Bad.tsx',
    code: "import { useState } from 'react';\nexport function Bad({ on }: { on: boolean }) {\n  if (on) useState(0);\n  return null;\n}\n",
    rule: 'react-hooks/rules-of-hooks',
  },
  {
    name: 'custom hook-ийг нөхцөл дотор дуудах (.ts — hooks дүрэм .ts-д ч үйлчилнэ)',
    file: 'components/ui/useBad.ts',
    code: "import { useState } from 'react';\nexport function useBad(on: boolean) {\n  if (on) useState(0);\n}\n",
    rule: 'react-hooks/rules-of-hooks',
  },

  // ---------- Ангилагдаагүй файл хилийг тойрохгүй ----------
  {
    name: 'ангилагдаагүй src/utils/ файл',
    file: 'utils/helper.ts',
    code: "import { useState } from 'react';\nexport const value = useState;\n",
    rule: 'boundaries/no-unknown-files',
  },
  {
    name: 'ангилагдаагүй src/test/ үндсэн файл',
    file: 'test/helpers.ts',
    code: 'export const value = 1;\n',
    rule: 'boundaries/no-unknown-files',
  },
  {
    name: 'vite-env.d.ts → импорт (ambient төрлийн файл юу ч импортлохгүй)',
    file: 'vite-env.d.ts',
    code: "import type { ReactNode } from 'react';\nexport type Value = ReactNode;\n",
    rule: 'boundaries/dependencies',
  },

  // ---------- Өмнө тестгүй байсан тохируулга ----------
  {
    name: 'LocalSimulationRuntime-д Date.now() (timer-ийн үл хамаарал цагт хамаарахгүй)',
    file: 'domain/runtime/LocalSimulationRuntime.ts',
    code: 'export const now = Date.now();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'LocalSimulationRuntime-д Math.random()',
    file: 'domain/runtime/LocalSimulationRuntime.ts',
    code: 'export const roll = Math.random();\n',
    rule: 'no-restricted-properties',
  },
  {
    name: 'LocalSimulationRuntime-ээс бусад domain файлд setInterval',
    file: 'domain/control/bad.ts',
    code: 'export const handle = setInterval(() => undefined, 1000);\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'domain-д document',
    file: 'domain/control/bad.ts',
    code: 'export const title = document.title;\n',
    rule: 'no-restricted-globals',
  },
  {
    name: 'domain-д localStorage',
    file: 'domain/control/bad.ts',
    code: "export const saved = localStorage.getItem('x');\n",
    rule: 'no-restricted-globals',
  },
  {
    name: 'app → LocalSimulationRuntime',
    file: 'app/Bad.ts',
    code: "import { fixtureLocalRuntime } from '@/domain/runtime/LocalSimulationRuntime';\nexport const value = fixtureLocalRuntime;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'LocalSimulationRuntime-д setTimeout (зөвхөн setInterval зөвшөөрөгдөнө)',
    file: 'domain/runtime/LocalSimulationRuntime.ts',
    code: 'export const handle = setTimeout(() => undefined, 10);\n',
    rule: 'no-restricted-globals',
  },
];

const allowed: Omit<Case, 'rule'>[] = [
  {
    name: 'domain тест → vitest ба src/test/domain',
    file: 'domain/control/good.test.ts',
    code: "import { expect } from 'vitest';\nimport { fixtureDomainBuilder } from '@/test/domain/builders';\nimport { fixtureTypes } from '@/domain/types';\nexport const value = [expect, fixtureDomainBuilder, fixtureTypes];\n",
  },
  {
    name: 'domain → domain',
    file: 'domain/control/good.ts',
    code: "import { fixtureTypes } from '@/domain/types';\nimport { fixtureI18n } from '@/domain/i18n/mn';\nexport const value = [fixtureTypes, fixtureI18n];\n",
  },
  {
    name: 'feature → өөрийн хавтас, store, domain/types, AerisRuntime',
    file: 'features/alpha/good.ts',
    code: "import { fixtureAlphaInternal } from './internal';\nimport { fixtureStore } from '@/store/uiStore';\nimport { fixtureTypes } from '@/domain/types';\nimport { fixtureRuntimeInterface } from '@/domain/runtime/AerisRuntime';\nexport const value = [fixtureAlphaInternal, fixtureStore, fixtureTypes, fixtureRuntimeInterface];\n",
  },
  {
    name: 'app → feature-ийн index, store',
    file: 'app/Good.ts',
    code: "import { fixtureAlpha } from '@/features/alpha';\nimport { fixtureStore } from '@/store/uiStore';\nexport const value = [fixtureAlpha, fixtureStore];\n",
  },
  {
    name: 'store → domain/types ба zustand',
    file: 'store/good.ts',
    code: "import { create } from 'zustand';\nimport { fixtureTypes } from '@/domain/types';\nexport const value = [create, fixtureTypes];\n",
  },
  {
    name: 'components/ui → react ба domain/i18n',
    file: 'components/ui/Good.ts',
    code: "import { useId } from 'react';\nimport { fixtureI18n } from '@/domain/i18n/mn';\nexport const value = [useId, fixtureI18n];\n",
  },
  {
    name: 'store тест → vitest ба src/test/ui',
    file: 'store/good.test.ts',
    code: "import { expect } from 'vitest';\nimport { fixtureUiRender } from '@/test/ui/render';\nexport const value = [expect, fixtureUiRender];\n",
  },
  {
    name: 'LocalSimulationRuntime-д setInterval/clearInterval',
    file: 'domain/runtime/LocalSimulationRuntime.ts',
    code: 'const handle = setInterval(() => undefined, 1000);\nclearInterval(handle);\nexport const value = handle;\n',
  },
  {
    name: 'src/main.tsx → бүгд (LocalSimulationRuntime, app, react-dom)',
    file: 'main.tsx',
    code: "import { createRoot } from 'react-dom/client';\nimport { fixtureApp } from '@/app/App';\nimport { fixtureLocalRuntime } from '@/domain/runtime/LocalSimulationRuntime';\nexport const value = [createRoot, fixtureApp, fixtureLocalRuntime];\n",
  },
  {
    name: 'store → AerisRuntime.ts (interface)',
    file: 'store/good.ts',
    code: "import { fixtureRuntimeInterface } from '@/domain/runtime/AerisRuntime';\nexport const value = fixtureRuntimeInterface;\n",
  },
  {
    name: 'vite-env.d.ts — зөвхөн triple-slash reference (баримтжуулсан үл хамаарал)',
    file: 'vite-env.d.ts',
    code: '/// <reference types="vite/client" />\n',
  },
];

// tooling/ нь апп-ын эх кодыг импортлохгүй (§9.3-ын tooling мөр); repo-ийн үндэснээс lint хийнэ.
const toolingViolations: Omit<Case, 'rule'>[] = [
  {
    name: 'tooling → @/ alias',
    file: 'tooling/bad.test.ts',
    code: "import { useUiStore } from '@/store/uiStore';\nexport const value = useUiStore;\n",
  },
  {
    name: 'tooling → харьцангуй ../src/',
    file: 'tooling/bad.test.ts',
    code: "import { useUiStore } from '../src/store/uiStore';\nexport const value = useUiStore;\n",
  },
];

describe('§9.3-ын 8-р дүрэм: зөрчил бүр lint алдаа өгнө', () => {
  it.each(violations)('$name → $rule', async ({ file, code, rule }) => {
    const messages = await lint(file, code);
    const errors = messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
    expect(errors).toContain(rule);
  });
});

describe('§9.3-ын 8-р дүрэм: зөвшөөрөгдсөн импорт алдаагүй', () => {
  it.each(allowed)('$name', async ({ file, code }) => {
    const messages = await lint(file, code);
    expect(messages.map((m) => `${m.ruleId}: ${m.message}`)).toEqual([]);
  });
});

describe('§9.3: tooling/ апп-ын эх кодыг импортлохгүй', () => {
  it.each(toolingViolations)('$name → no-restricted-imports', async ({ file, code }) => {
    const messages = await lint(file, code, repoRoot);
    const errors = messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
    expect(errors).toContain('no-restricted-imports');
  });

  it('tooling → node:fs ба vitest зөвшөөрөгдөнө', async () => {
    const code =
      "import { readFileSync } from 'node:fs';\nimport { expect } from 'vitest';\nexport const value = [readFileSync, expect];\n";
    const messages = await lint('tooling/good.test.ts', code, repoRoot);
    expect(messages.map((m) => `${m.ruleId}: ${m.message}`)).toEqual([]);
  });
});
