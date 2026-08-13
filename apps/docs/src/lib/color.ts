/* Color math for the foundations pages: oklch (the tokens' native space) to
   sRGB, and WCAG 2.x contrast ratios.

   The math itself is @elirobinson/tokens' job, the same way parsing tokens.css
   is. It moved there when packages/tokens grew contrast.test.mjs — the gate
   that fails a build if a token misses its AA threshold. Two copies would mean
   the docs and the gate could disagree about whether a color passes, which is
   the one thing neither is allowed to do. This module stays as the docs' import
   path so the foundations components did not have to change. */

export type { AaVerdict, Rgb } from '@elirobinson/tokens/color';
export { aaVerdict, contrastRatio, parseColor, toHex } from '@elirobinson/tokens/color';
