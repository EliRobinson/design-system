// @ts-check
// Character patterns the shell parser and the zsh glob qualifier reader
// share. No imports, so both may import it.

/** After a `$`: a character that starts an expansion. */
export const EXPANSION_START = /^[\w{@*#?$!-]$/;

/** After an unquoted `$`: `$'...'` and `$"..."`, read as quotes. */
export const QUOTE_START = /^['"]$/;

/** An unquoted brace expansion, `{a,b}` or `{1..3}`; not gh's `{owner}`. */
export const BRACE_EXPANSION = /^\{[^{}\s'"]*(,|\.\.)[^{}\s'"]*\}/;
