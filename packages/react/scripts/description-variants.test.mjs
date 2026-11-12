// @vitest-environment node

// The check run against this package's real manifest lives in
// manifest.test.mjs, which builds that manifest once for every test.

import { describe, expect, it } from 'vitest';

import { variantClaims } from './description-variants.mjs';

const component = (name, description, variants = []) => ({ name, description, variants });

const alert = component('Alert', 'Status callout.', [
  { prop: 'variant', values: ['default', 'success', 'danger'] },
]);

describe('variantClaims', () => {
  it('flags a description that lists its own variants', () => {
    const badge = component('Badge', 'Status label in solid and outline variants.', [
      { prop: 'variant', values: ['solid', 'outline'] },
    ]);

    expect(variantClaims({ components: [badge] })).toEqual([
      { component: 'Badge', claim: 'solid' },
      { component: 'Badge', claim: 'outline' },
    ]);
  });

  it('flags a variant the component does not have', () => {
    // `danger` is Alert's; Button's destructive variant is not called that.
    const button = component('Button', 'Action control, including a danger style.', [
      { prop: 'variant', values: ['primary', 'destructive'] },
    ]);

    expect(variantClaims({ components: [alert, button] })).toEqual([
      { component: 'Button', claim: 'danger' },
    ]);
  });

  it('flags a count of variants', () => {
    const spinner = component('Spinner', 'Loading indicator in three sizes.', [
      { prop: 'size', values: ['sm', 'lg'] },
    ]);

    expect(variantClaims({ components: [spinner] })).toEqual([
      { component: 'Spinner', claim: 'three sizes' },
    ]);
  });

  it('matches whole words only', () => {
    const popover = component('Popover', 'Anchored panel with a defaulted width.', [
      { prop: 'variant', values: ['anchor', 'default'] },
    ]);

    expect(variantClaims({ components: [popover] })).toEqual([]);
  });

  it('ignores numeric values, which read as ordinary numbers in prose', () => {
    const accordion = component('Accordion', 'Sections under a level 2 heading.', [
      { prop: 'headingLevel', values: [1, 2, 3] },
    ]);

    expect(variantClaims({ components: [accordion] })).toEqual([]);
  });

  it('leaves a component with no variant props alone', () => {
    const field = component('FieldError', 'Renders nothing with no message.');

    expect(variantClaims({ components: [alert, field] })).toEqual([]);
  });
});
