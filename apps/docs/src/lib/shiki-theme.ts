import type { ThemeRegistrationRaw } from 'shiki';

/* Brand code theme: ink-led with forest strings and dark-amber constants —
   no purple, per the brand rules. Hex values are the sRGB conversions of the
   ink/signal/anchor oklch tokens (computed with src/lib/color.ts); every
   text color meets WCAG AA on the --bg-muted code background. */
export const miltinsonLight: ThemeRegistrationRaw = {
  name: 'miltinson-light',
  type: 'light',
  settings: [],
  colors: {
    'editor.background': '#f6f7f8',
    'editor.foreground': '#12171a',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#6e7276', fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'],
      settings: { foreground: '#000000', fontStyle: 'bold' },
    },
    {
      scope: ['string', 'string.quoted', 'punctuation.definition.string'],
      settings: { foreground: '#215a3a' },
    },
    {
      scope: [
        'constant',
        'constant.numeric',
        'constant.language',
        'support.constant',
        'variable.other.constant',
      ],
      settings: { foreground: '#a94608' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#2a2e33' },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.name.tag',
      ],
      settings: { foreground: '#164229' },
    },
    {
      scope: ['entity.other.attribute-name', 'variable.parameter', 'support.type.property-name'],
      settings: { foreground: '#494e52' },
    },
    {
      scope: ['punctuation', 'keyword.operator', 'meta.brace'],
      settings: { foreground: '#6e7276' },
    },
    {
      scope: ['variable', 'variable.other'],
      settings: { foreground: '#12171a' },
    },
  ],
};
