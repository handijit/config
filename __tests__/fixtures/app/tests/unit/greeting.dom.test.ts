import { describe, expect, it } from 'vitest';

import { greeting } from '@shared/helpers/greeting.helper';

describe('greeting in the page', () => {
  it('renders into a DOM', () => {
    document.body.textContent = greeting('Ada');
    expect(document.body.textContent).toBe('Hello, Ada');
  });
});
