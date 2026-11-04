import { expect } from 'vitest';

/** Every id in the control's `aria-describedby` must name an element in the document. */
export function expectNoDanglingDescribedBy(control: HTMLElement) {
  const ids = control.getAttribute('aria-describedby')?.split(' ') ?? [];
  for (const id of ids) expect(document.getElementById(id), `#${id}`).not.toBeNull();
}
