import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('анхдагч type="button" (form-ыг санамсаргүй submit хийхгүй), ui-button класстай', () => {
    render(<Button>Үргэлжлүүлэх</Button>);
    const button = screen.getByRole('button', { name: 'Үргэлжлүүлэх' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('ui-button');
  });

  it('нэмэлт класс ба атрибутыг дамжуулна', () => {
    render(
      <Button className="extra" aria-label="Түр зогсоох" disabled>
        ⏸
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Түр зогсоох' });
    expect(button).toHaveClass('ui-button', 'extra');
    expect(button).toBeDisabled();
  });
});
