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
      { component: 'Badge', claim: 'solid and outline' },
    ]);
  });

  it('flags a variant the component does not have', () => {
    // `danger` is Alert's; Button's destructive variant is not called that.
    const button = component('Button', 'Action control in danger or success styles.', [
      { prop: 'variant', values: ['primary', 'destructive'] },
    ]);

    expect(variantClaims({ components: [alert, button] })).toEqual([
      { component: 'Button', claim: 'danger or success' },
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

  it('counts in the words of any variant prop, not a fixed list', () => {
    const card = component('DecisionCard', 'A verdict card in two layouts.', [
      { prop: 'figureLayout', values: ['metric', 'prose'] },
    ]);

    expect(variantClaims({ components: [card] })).toEqual([
      { component: 'DecisionCard', claim: 'two layouts' },
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

  it('flags a list of variant values on a component with no variant props', () => {
    const slider = component('Slider', 'Range input in success/danger tones.');

    expect(variantClaims({ components: [alert, slider] })).toEqual([
      { component: 'Slider', claim: 'success/danger' },
    ]);
  });

  it("leaves a lone word from another component's union alone", () => {
    const rating = component('Rating', 'Read-only by default; a success when filled.');

    expect(variantClaims({ components: [alert, rating] })).toEqual([]);
  });

  it('reports a listed run once, not once per value in it', () => {
    const avatar = component('Avatar', 'Image avatar in sm/md/lg sizes.', [
      { prop: 'size', values: ['sm', 'md', 'lg'] },
    ]);

    expect(variantClaims({ components: [avatar] })).toEqual([
      { component: 'Avatar', claim: 'sm/md/lg' },
    ]);
  });

  it('checks sub-component descriptions against their own unions', () => {
    const card = {
      ...component('Card', 'Content surface.'),
      subComponents: [
        {
          name: 'CardTitle',
          description: 'Title, h3 by default.',
          props: [{ name: 'as', type: '"h2" | "h3"' }],
        },
      ],
    };

    expect(variantClaims({ components: [card] })).toEqual([
      { component: 'Card.CardTitle', claim: 'h3' },
    ]);
  });

  it('ignores an empty literal rather than matching every description', () => {
    const select = component('Select', 'Native select.', [{ prop: 'size', values: ['', 'lg'] }]);

    expect(variantClaims({ components: [select] })).toEqual([]);
  });
});
