// Апп эхлэх дэлгэц (D106): барилгын өгөгдлийг серверээс ачаалах үеийн төлөв.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';

import { StartupScreen } from './StartupScreen';

const text = mn.common.server;

describe('StartupScreen', () => {
  it('ачаалж байх үед мэдэгдэнэ', () => {
    render(<StartupScreen state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(text.startupLoading);
  });

  it('сервер ажиллахгүй бол алдаа ба «Дахин оролдох» товч', async () => {
    const onRetry = vi.fn();
    render(<StartupScreen state="error" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text.startupErrorTitle);
    await userEvent.click(screen.getByRole('button', { name: text.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
