import tokenData from './tokens.json' with { type: 'json' };

export const tokens = tokenData;
export type Tokens = typeof tokenData;
