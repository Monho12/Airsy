// Үндсэн товч (CLAUDE.md §8.4, §8.7, §8.8, D74). Анхдагч `type="button"`; focus-ийн хүрээ globals.css-ээс.
// Хэлбэр нь app/-ын `.shell-button`-тай ижил токен (feature-ээс app/-ийг импортлох хориотой тул энд, §9.3).
import type { ButtonHTMLAttributes } from 'react';

export function Button({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={className === undefined ? 'ui-button' : `ui-button ${className}`}
      {...props}
    />
  );
}
