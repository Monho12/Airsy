// AERIS ESLint тохиргоо (flat config).
// Архитектурын хилийг (CLAUDE.md §9.3) eslint-plugin-boundaries-ээр, deterministic domain-ийн хоригийг
// core дүрмүүдээр сахиулна. Дүрэм бүрийг tooling/lint-boundaries.test.ts зориуд зөрчсөн жишээгээр шалгана.
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Lint-ийн шалгалтын fixture нь src-ийн бүтцийг давтдаг тул ижил дүрэм түүнд ч үйлчилнэ.
const FIXTURE_SRC = 'tooling/fixtures/boundaries/src';
const SRC_ROOTS = ['src', FIXTURE_SRC];
/** src болон fixture-ийн аль алинд нь тохирох glob-уудыг үүсгэнэ. */
const inSrc = (pattern) => SRC_ROOTS.map((root) => `${root}/${pattern}`);

// ---------- Архитектурын элементүүд (§9.3) ----------
const DOMAIN = ['domain-types', 'domain-config', 'domain-i18n', 'domain-runtime', 'domain-module'];

const elements = [
  // Тодорхой domain хэсгүүдийг эхэлж, `exclusive`-ээр тодорхойлно — ерөнхий `domain-module`-д давхар орохгүй.
  { type: 'domain-types', pattern: 'src/domain/types', exclusive: true },
  { type: 'domain-config', pattern: 'src/domain/config', exclusive: true },
  { type: 'domain-i18n', pattern: 'src/domain/i18n', exclusive: true },
  { type: 'domain-runtime', pattern: 'src/domain/runtime', exclusive: true },
  { type: 'domain-module', pattern: 'src/domain/*', capture: ['module'] },
  { type: 'store', pattern: 'src/store' },
  { type: 'components-ui', pattern: 'src/components/ui' },
  { type: 'feature', pattern: 'src/features/*', capture: ['featureName'] },
  { type: 'app', pattern: 'src/app' },
  { type: 'styles', pattern: 'src/styles' },
  { type: 'test-domain', pattern: 'src/test/domain' },
  { type: 'test-ui', pattern: 'src/test/ui' },
];

// Элементэд хамаарахгүй ч зөвшөөрөгдсөн цорын ганц хоёр файл (баримтжуулсан үл хамаарал, §9.3):
// `main.tsx` (эхлэх цэг) ба `vite-env.d.ts` (Vite-ийн ambient төрөл; policy байхгүй тул импорт хийж чадахгүй).
// Бусад ангилагдаагүй файлыг `boundaries/no-unknown-files` алдаа болгоно — хилийг тойрох боломжгүй.
const files = [
  { category: 'test', pattern: '**/*.test.{ts,tsx}' },
  { category: 'entry', pattern: '**/src/main.tsx' },
  { category: 'ambient-types', pattern: '**/src/vite-env.d.ts' },
];

// ---------- Туслах selector-ууд ----------
const toElements = (...types) => types.map((type) => ({ to: { element: { type } } }));
const toExternal = (...sources) =>
  sources.map((source) => ({ to: { module: { origin: 'external', source } } }));
const testFile = { file: { categories: 'test' } };

// 3D сан (D56): зөвхөн features/building3d/** импортолно. Module-ийн `source` нь үндсэн нэр ('three/examples/…' → 'three')
// тул import-ийн яг бичвэрийг (`dependency.source`) мөн шаардана — дэд зам (three/examples/*, three/addons/*) хориотой хэвээр.
const THREE_D_MODULES = ['three', '@react-three/fiber', '@react-three/drei'];
const toThreeD = THREE_D_MODULES.map((source) => ({
  to: { module: { origin: 'external', source } },
  dependency: { source },
}));

// Элементийн дотоод импорт (feature-ийн «өөрийн хавтас» гэх мэт) анхдагчаар шалгагдахгүй (checkInternals: false).
const policies = [
  // domain/** → зөвхөн domain/** (React, store, UI, гадаад сан хориотой)
  { from: { element: { types: { anyOf: DOMAIN } } }, allow: toElements(...DOMAIN) },
  // Domain тест: дээр нь зөвхөн vitest ба src/test/domain/** (React, @testing-library/*, src/test/ui/** хориотой)
  {
    from: { element: { types: { anyOf: DOMAIN } }, ...testFile },
    allow: [...toElements('test-domain'), ...toExternal('vitest')],
  },

  // store/** → domain/** (LocalSimulationRuntime-ээс бусад), Zustand
  {
    from: { element: { type: 'store' } },
    allow: [
      ...toElements('domain-types', 'domain-config', 'domain-i18n', 'domain-module'),
      {
        to: { element: { type: 'domain-runtime', fileInternalPath: '!LocalSimulationRuntime.ts' } },
      },
      ...toExternal('zustand'),
    ],
  },

  // components/ui/** → domain/types, domain/i18n, React, lucide-react, styles
  {
    from: { element: { type: 'components-ui' } },
    allow: [
      ...toElements('domain-types', 'domain-i18n', 'styles'),
      ...toExternal('react', 'lucide-react'),
    ],
  },

  // features/<нэр>/** → өөрийн хавтас, components/ui, store, domain/types|i18n|config, AerisRuntime.ts
  {
    from: { element: { type: 'feature' } },
    allow: [
      ...toElements('components-ui', 'store', 'domain-types', 'domain-i18n', 'domain-config'),
      { to: { element: { type: 'domain-runtime', fileInternalPath: 'AerisRuntime.ts' } } },
      ...toExternal('react', 'lucide-react', 'zustand'),
    ],
  },

  // features/building3d/** (тест файл орно) → дээр нь зөвхөн three, @react-three/fiber, @react-three/drei (D56)
  {
    from: { element: { type: 'feature', captured: { featureName: 'building3d' } } },
    allow: toThreeD,
  },

  // app/** → features/<нэр>/index.ts, components/ui, store, domain/types|i18n|config
  {
    from: { element: { type: 'app' } },
    allow: [
      { to: { element: { type: 'feature', fileInternalPath: 'index.ts' } } },
      ...toElements('components-ui', 'store', 'domain-types', 'domain-i18n', 'domain-config'),
      ...toExternal('react', 'lucide-react'),
    ],
  },

  // src/test/domain/** → зөвхөн domain/** ба vitest
  {
    from: { element: { type: 'test-domain' } },
    allow: [...toElements(...DOMAIN), ...toExternal('vitest')],
  },

  // src/test/ui/** → domain/**, store, components/ui, src/test/domain/**, vitest, @testing-library/*
  {
    from: { element: { type: 'test-ui' } },
    allow: [
      ...toElements(...DOMAIN, 'store', 'components-ui', 'test-domain'),
      ...toExternal('vitest', '@testing-library/*'),
    ],
  },

  // Domain бус тест: тухайн давхаргын импорт дээр нь vitest, @testing-library/*, src/test/**
  {
    from: {
      element: { types: { anyOf: ['store', 'components-ui', 'feature', 'app', 'styles'] } },
      ...testFile,
    },
    allow: [...toElements('test-domain', 'test-ui'), ...toExternal('vitest', '@testing-library/*')],
  },

  // src/main.tsx — бүгдийг импортолж болох цорын ганц газар (LocalSimulationRuntime-ийг үүсгэнэ)
  {
    from: { file: { categories: 'entry' } },
    allow: [{ to: { element: { type: '*' } } }, { to: { module: { origin: 'external' } } }],
  },
];

// ---------- Deterministic domain (§9.3, 3-р дүрэм) ----------
const restrictedTimeProperties = [
  {
    object: 'Date',
    property: 'now',
    message: 'Domain-д симуляцийн цагийг ашигла (§9.3-ын 3-р дүрэм).',
  },
  {
    object: 'performance',
    property: 'now',
    message: 'Domain-д симуляцийн цагийг ашигла (§9.3-ын 3-р дүрэм).',
  },
  {
    object: 'Math',
    property: 'random',
    message: 'Domain-д seed-тэй simulation/rng-ийг ашигла (§9.3-ын 3-р дүрэм).',
  },
];
const timerGlobals = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
const domGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'requestAnimationFrame',
];
const restrictedGlobal = (name) => ({
  name,
  message: `Domain-д \`${name}\` хориотой (§9.3-ын 3-р дүрэм).`,
});

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'node_modules/']),

  js.configs.recommended,
  tseslint.configs.recommended,

  // ---------- React hooks (.tsx компонент ба .ts дахь custom hook, жишээ нь store/runtime.ts-ийн useRuntime) ----------
  {
    files: inSrc('**/*.{ts,tsx}'),
    ...reactHooks.configs.flat.recommended,
  },

  // ---------- Архитектурын хил ----------
  {
    files: inSrc('**/*.{ts,tsx}'),
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.app.json', 'tooling/fixtures/boundaries/tsconfig.json'],
          // Апп ба lint-ийн fixture хоёр тусдаа tsconfig-той нь зориуд.
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/elements': elements,
      'boundaries/files': files,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          // Гадаад багц (react, vitest, @testing-library/*) ба ангилагдаагүй локал файлыг ч allow-list-ээр шалгана.
          checkAllOrigins: true,
          checkUnknownLocals: true,
          message: 'Архитектурын хил зөрчигдсөн (CLAUDE.md §9.3).',
          policies,
        },
      ],
      'boundaries/no-unknown-files': 'error',
      // Дээд хавтас хооронд харьцангуй `../` импорт хориотой — `@/` alias ашигла (§9.3-ын 1-р дүрэм).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\./)+(app|components|features|store|domain|styles|test)(/|$)',
              message: 'Дээд хавтас хооронд `@/` alias ашигла (§9.3-ын 1-р дүрэм).',
            },
          ],
        },
      ],
    },
  },

  // ---------- Deterministic domain ба domain тестийн туслах ----------
  {
    files: [...inSrc('domain/**/*.{ts,tsx}'), ...inSrc('test/domain/**/*.{ts,tsx}')],
    rules: {
      'no-restricted-properties': ['error', ...restrictedTimeProperties],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Domain-д аргументгүй `new Date()` хориотой (§9.3-ын 3-р дүрэм).',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[...timerGlobals, ...domGlobals, 'performance'].map(restrictedGlobal),
      ],
    },
  },
  // ---------- tooling/ — архитектурын давхаргаас гадуур (§9.3-ын tooling мөр) ----------
  // Апп-ын эх кодыг импортлохгүй (шаардлагатай бол `fs`-ээр уншина). Fixture нь өөрөө src-ийн дүрмээр шалгагдана.
  {
    files: ['tooling/**/*.ts'],
    ignores: [`${FIXTURE_SRC}/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@/',
              message: 'tooling/ апп-ын эх кодыг импортлохгүй — `fs`-ээр унш (§9.3).',
            },
            {
              regex: '(^|/)src(/|$)',
              message: 'tooling/ апп-ын эх кодыг импортлохгүй — `fs`-ээр унш (§9.3).',
            },
          ],
        },
      ],
    },
  },

  // Ганц үл хамаарал: LocalSimulationRuntime давталтын ганц timer-ийг эзэмшинэ (§11.1).
  {
    files: inSrc('domain/runtime/LocalSimulationRuntime.ts'),
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          ...timerGlobals.filter((n) => !n.endsWith('Interval')),
          ...domGlobals,
          'performance',
        ].map(restrictedGlobal),
      ],
    },
  },
]);
