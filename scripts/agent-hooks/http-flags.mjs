// @ts-check
// Reads an HTTP client call (curl, wget, and httpie's `http`/`https` or xh's
// `xh`/`xhs`) for the merge-bypass check in review-gate-bypass.mjs: whether
// it may write, and which words stand where its URL goes. `methodWrites` is
// shared with that file's gh api check. No I/O.
//
// The option tables below only choose the URL words, for the weaker
// run-time host check. Whether a call writes is read without them, so a
// missing or wrong table entry can only add a refusal, never hide a write.
// A body read from a redirect (`http PUT <url> < body.json`) is not a word,
// so it is not seen; the method word still is.

/** @typedef {import('./shell-parse.mjs').Word} Word */

// HTTP methods that only read, in gh api or an HTTP client.
const READ_METHOD = /^(GET|HEAD)$/i;
const ANY_METHOD = /^(GET|HEAD|PUT|POST|PATCH|DELETE|OPTIONS)$/i;
// Text that may be a method once the shell builds it: letters, and the
// characters of an expansion or a filename pattern (`P[U]T`, `"$M"`). The
// extglob characters (`@`, `!`, `+`, `(`, `)`) are kept on purpose:
// `@(PUT)` is a pattern too.
const METHOD_SHAPED = /^[A-Za-z?*[\]$"'{}@!+()]+$/;
// A long option, `--name` or `--name=value`.
const LONG_OPTION = /^--(?<name>[\w-]+)(?:=(?<value>.*))?$/;
// A short option bundle: its letters (curl has `-4`, `-#` too), then the
// rest of the word, which may hold a glued value.
const SHORT_BUNDLE = /^-(?<letters>[a-zA-Z0-9#]+)(?<tail>.*)$/;
// An httpie or xh item that sends a body (`a=b`, `a:=1`, `a@file`), and any
// item, a query (`a==b`) or a header (`h:v`) too.
const HTTPIE_BODY_ITEM = /^[\w.[\]-]+(?::?=(?!=)|@)/;
const HTTPIE_ITEM = /^[\w.[\]-]+(?:==|:=|=|@)/;
// The bodies of `${...}` and `$(...)`, whose `:`, `/` or `.` are not a URL's.
const EXPANSION_BODY = /\$\{[^}]*\}|\$\([^)]*\)/g;

/**
 * Whether a method may write: one built at run time (`-X "$M"`, `P[U]T`), or
 * any method but GET or HEAD.
 * @param {{ text: string, dynamic: boolean }} method
 */
export const methodWrites = (method) => method.dynamic || !READ_METHOD.test(method.text);

/**
 * How one client reads its options.
 * - `shortValues`, `longValues`: the options that take a value, glued
 *   (`-HAccept:x`, `--header=x`) or as the next word.
 * - `shortMethod`, `longMethod`: the options that name the method.
 * - `shortBody`, `longBody`: the options that send a body.
 * - `httpieSyntax`: the call is `[METHOD] URL [ITEM...]`, as httpie and xh
 *   read it. Three effects: a word built at run time before another word
 *   may be the method; an item (`a=b`, `a@file`) sends a body; and method
 *   words and items are not URL words.
 * An empty string or set means the client has none.
 * @typedef {{ shortValues: string, longValues: Set<string>, shortMethod: string, longMethod: Set<string>, shortBody: string, longBody: RegExp, httpieSyntax: boolean }} HttpClient
 */

/** @param {string} list  option names, space-separated, without the `--` */
const optionNames = (list) => new Set(list.split(' ').filter(Boolean));

/** @type {{ curl: HttpClient, wget: HttpClient, httpie: HttpClient }} */
const HTTP_CLIENTS = {
  curl: {
    shortValues: 'XHodFTuAebcxwKErmCDPYyzUQt',
    longValues: optionNames(
      'request header output user user-agent referer cookie cookie-jar url config write-out proxy ' +
        'data data-raw data-binary data-urlencode data-ascii json form form-string upload-file ' +
        'cacert capath cert key unix-socket abstract-unix-socket dump-header output-dir trace ' +
        'trace-ascii stderr netrc-file oauth2-bearer connect-timeout max-time retry resolve connect-to',
    ),
    shortMethod: 'X',
    longMethod: optionNames('request'),
    shortBody: 'dFT',
    longBody: /^(data|json|form|upload-file)/,
    httpieSyntax: false,
  },
  wget: {
    shortValues: 'oaiBeOPUtTwQlARDIX',
    longValues: optionNames(
      'method header output-document output-file user password user-agent referer url ' +
        'post-data post-file body-data body-file',
    ),
    shortMethod: '',
    longMethod: optionNames('method'),
    shortBody: '',
    longBody: /^(post-|body-)/,
    httpieSyntax: false,
  },
  httpie: {
    shortValues: 'aoApP',
    longValues: optionNames('auth auth-type output session session-read-only url raw'),
    shortMethod: '',
    longMethod: optionNames(''),
    shortBody: '',
    longBody: /^raw$/,
    httpieSyntax: true,
  },
};

/** @type {Record<string, keyof typeof HTTP_CLIENTS>} The client each program is. */
const CLIENT_OF = {
  curl: 'curl',
  wget: 'wget',
  http: 'httpie',
  https: 'httpie',
  xh: 'httpie',
  xhs: 'httpie',
};

/** Every program name `readHttpRequest` reads. */
export const HTTP_PROGRAMS = Object.keys(CLIENT_OF);

/**
 * On an httpie line, whether a word that is not an option may write: an item
 * that sends a body, or a word built at run time with a word after it that
 * is not URL-shaped, which may be the method (`http "$M" <url>`,
 * `http ${M:-PUT} <url>`).
 * @param {Word} word
 * @param {Word | undefined} next
 */
function lineWordWrites(word, next) {
  if (HTTPIE_BODY_ITEM.test(word.text)) return true;
  const shape = word.text.replace(EXPANSION_BODY, '$');
  return word.dynamic && next !== undefined && !/[/.:=@]/.test(shape);
}

/**
 * Whether a long option may write: a body option, or a method option whose
 * value may write.
 * @param {Word} word
 * @param {Word | undefined} next
 * @param {HttpClient} client
 */
function longWrites(word, next, client) {
  const { name = '', value } = LONG_OPTION.exec(word.text)?.groups ?? {};
  if (client.longBody.test(name)) return true;
  if (!client.longMethod.has(name)) return false;
  if (value !== undefined) return methodWrites({ ...word, text: value });
  return next !== undefined && methodWrites(next);
}

/**
 * Whether a short option bundle may write. Up to the method letter, each
 * letter may be a body option (a letter that is really a glued value only
 * adds a refusal); past it is the method, glued or the next word.
 * @param {Word} word
 * @param {Word | undefined} next
 * @param {HttpClient} client
 */
function bundleWrites(word, next, client) {
  const { letters = '', tail = '' } = SHORT_BUNDLE.exec(word.text)?.groups ?? {};
  const at = [...letters].findIndex((flag) => client.shortMethod.includes(flag));
  const before = at === -1 ? letters : letters.slice(0, at);
  if ([...before].some((flag) => client.shortBody.includes(flag))) return true;
  if (at === -1) return false;
  const value = (letters.slice(at + 1) + tail).replace(/^=/, '');
  if (value === '') return next !== undefined && methodWrites(next);
  // `${M:-PUT}` and `$(echo PUT)` may be a method; `-A: $V` (the rest of a
  // glued `-HX-A: $V` header) is not.
  const shape = value.replace(EXPANSION_BODY, '$');
  return METHOD_SHAPED.test(shape) && methodWrites({ ...word, text: value });
}

/**
 * Whether an HTTP client call may write, read without the option tables:
 * a writing method word anywhere (`PUT`, `OPTIONS`), or a word that may
 * write by its shape (see `lineWordWrites`, `longWrites`, `bundleWrites`).
 * @param {Word[]} args
 * @param {HttpClient} client
 */
function mayWrite(args, client) {
  return args.some((word, i) => {
    const next = args[i + 1];
    if (ANY_METHOD.test(word.text) && methodWrites({ ...word, dynamic: false })) return true;
    if (LONG_OPTION.test(word.text)) return longWrites(word, next, client);
    if (SHORT_BUNDLE.test(word.text)) return bundleWrites(word, next, client);
    return client.httpieSyntax && !word.text.startsWith('-') && lineWordWrites(word, next);
  });
}

/**
 * The words that stand where a URL goes, read with the client's option
 * tables: the words that are not options or option values, past `--` every
 * word, and `--url` values. With httpie syntax, method words and items are
 * not URLs either.
 * @param {Word[]} args
 * @param {HttpClient} client
 * @returns {Word[]}
 */
function urlWords(args, client) {
  /** @type {Word[]} */
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const word = /** @type {Word} */ (args[i]);
    const { text } = word;
    // The value an option takes: the rest of its word, or the next word.
    const takeValue = (/** @type {string} */ rest) =>
      rest === '' ? args[++i] : { ...word, text: rest };
    if (text === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    const long = LONG_OPTION.exec(text)?.groups;
    if (long) {
      const name = long.name ?? '';
      const taken =
        long.value !== undefined
          ? takeValue(long.value)
          : client.longValues.has(name)
            ? takeValue('')
            : undefined;
      if (name === 'url' && taken) positional.push(taken);
      continue;
    }
    if (/^-[^-]/.test(text)) {
      const at = [...text.slice(1)].findIndex((flag) => client.shortValues.includes(flag));
      if (at !== -1) takeValue(text.slice(at + 2).replace(/^=/, ''));
      continue;
    }
    positional.push(word);
  }
  if (!client.httpieSyntax) return positional;
  return positional.filter(({ text }) => !ANY_METHOD.test(text) && !HTTPIE_ITEM.test(text));
}

/**
 * Reads an HTTP client call: whether it may write (see `mayWrite`), and the
 * words that stand where its URL goes (see `urlWords`). Null for a program
 * that is not an HTTP client.
 * @param {string} program
 * @param {Word[]} args  the words after the program
 * @returns {{ writes: boolean, urls: Word[] } | null}
 */
export function readHttpRequest(program, args) {
  if (!Object.hasOwn(CLIENT_OF, program)) return null;
  const client = HTTP_CLIENTS[/** @type {keyof typeof HTTP_CLIENTS} */ (CLIENT_OF[program])];
  return { writes: mayWrite(args, client), urls: urlWords(args, client) };
}

/**
 * Whether a URL's host has a run-time part and is not exactly one variable,
 * as in `https://api.$D/...`, `api.github.c[o]m/...` or `user:$PW@host/...`.
 * A port is not part of the host (`localhost:$PORT`). A host that is one
 * variable (`$API_URL/users`, `${API}/x`) is out of scope, like
 * `curl -X PUT $URL`. A word with no scheme and no `/` is not taken for a URL.
 * @param {string} text
 */
export function hasRunTimeHost(text) {
  const url = /^(?:(?<scheme>[a-z][\w+.-]*):\/\/)?(?<host>[^/]*)(?<slash>\/)?/i.exec(text)?.groups;
  if (!url || (url.scheme === undefined && url.slash === undefined)) return false;
  const host = (url.host ?? '').replace(/:(?:\d+|\$\w+|\$\{\w+\})$/, '');
  if (/^\$(?:\w+|\{\w+\})$/.test(host)) return false;
  return /[$`*?[{(]/.test(host);
}
