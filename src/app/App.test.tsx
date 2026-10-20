import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mn } from '@/domain/i18n/mn';

import { App } from './App';

describe('App shell (smoke)', () => {
  it('AERIS нэр ба СИМУЛЯЦИ тэмдэгтэй зурагдана', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AERIS');
    expect(screen.getByText(mn.common.simulationBadge)).toBeInTheDocument();
  });

  it('§8.2-ын бүх орлуулагч хэсэг шошготой region болж зурагдана', () => {
    render(<App />);
    for (const label of Object.values(mn.common.regions)) {
      expect(screen.getByRole('region', { name: label })).toBeInTheDocument();
    }
  });

  it('интерактив элемент (товч, холбоос, оролт) байхгүй — хуурамч удирдлага хориотой (§8.7)', () => {
    render(<App />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('хуудасны гарчиг Монгол хэлээр', () => {
    render(<App />);
    expect(document.title).toBe(mn.common.documentTitle);
  });
});

// UI тест jsdom орчинд, UI setup-тэй ажиллах ёстой (D41).
describe('ui тестийн орчин', () => {
  it('DOM ба jest-dom matcher ачаалагдсан', () => {
    expect(typeof document).toBe('object');
    expect('toBeInTheDocument' in expect(null)).toBe(true);
  });
});
