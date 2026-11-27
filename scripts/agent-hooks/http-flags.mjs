// @ts-check
// Reads an HTTP client call (curl, wget, httpie, xh) for the merge-bypass
// check in review-gate-bypass.mjs: whether it may write, and which words
// stand where its URL goes. No I/O.
//
// The option tables below only choose the URL words, for the weaker
// run-time host check. Whether a call writes is read without them, so a
// missing or wrong table entry can only add a refusal, never hide a write.

/** @typedef {import('./shell-parse.mjs').Word} Word */

// HTTP methods that only read, in gh api or an HTTP client.
const READ_METHOD = /^(GET|HEAD)$/i;
const ANY_METHOD = /^(GET|HEAD|PUT|POST|PATCH|DELETE|OPTIONS)$/i;
// Text that may be a method once the shell builds it: letters, and the
// characters of an expansion or a filename pattern (`P[U]T`, `"$M"`).
const METHOD_SHAPED = /^[A-Za-z?*[\]$"'{}@!+()]+$/;
// An httpie or xh item that sends a body (`a=b`, `a:=1`, `a@file`), and any
// item, a query (`a==b`) or a header (`h:v`) too.
const HTTPIE_BODY_ITEM = /^[\w.[\]-]+(?::?=(?!=)|@)/;
const HTTPIE_ITEM = /^[\w.[\]-]+(?:==|:=|=|@)/;

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
 * - `line`: whether the method may stand before the URL, as httpie's
 *   `http PUT <url>`.
 * @typedef {{ shortValues: string, longValues: Set<string>, shortMethod: string, longMethod: Set<string>, shortBody: string, longBody: RegExp | null, line: boolean }} HttpClient
 */

/** @param {string} names  space-separated, without the `--` */
const names = (names) => new Set(names.split(' '));

/** @type {{ curl: HttpClient, wget: HttpClient, httpie: HttpClient }} */
export const HTTP_CLIENTS = {
  curl: {
    shortValues: 'XHodFTuAebcxwKErmCDPYyzUQt',
    longValues: names(
      'request header output user user-agent referer cookie cookie-jar url config write-out proxy ' +
        'data data-raw data-binary data-urlencode data-ascii json form form-string upload-file ' +
        'cacert capath cert key unix-socket abstract-unix-socket dump-header output-dir trace ' +
        'trace-ascii stderr netrc-file oauth2-bearer connect-timeout max-time retry resolve connect-to',
    ),
    shortMethod: 'X',
    longMethod: names('request'),
    shortBody: 'dFT',
    longBody: /^(data|json|form|upload-file)/,
    line: false,
  },
  wget: {
    shortValues: 'oaiBeOPUtTwQlARDIX',
    longValues: names(
      'method header output-document output-file user password user-agent referer url ' +
        'post-data post-file body-data body-file',
    ),
    shortMethod: '',
    longMethod: names('method'),
    shortBody: '',
    longBody: /^(post-|body-)/,
    line: false,
  },
  httpie: {
    shortValues: 'aoApP',
    longValues: names('auth auth-type output session session-read-only url'),
    shortMethod: '',
    longMethod: new Set(),
    shortBody: '',
    longBody: null,
    line: true,
  },
};

/** The programs each client record reads. */
const CLIENT_OF = /** @type {const} */ ({
  curl: 'curl',
  wget: 'wget',
  http: 'httpie',
  https: 'httpie',
  xh: 'httpie',
  xhs: 'httpie',
});

/** Every program name `readHttpRequest` reads. */
export const HTTP_PROGRAMS = Object.keys(CLIENT_OF);

/**
 * Whether an HTTP client call may write, read without the option tables:
 * - a word that is a writing method (`PUT`, `OPTIONS`), anywhere;
 * - a method option (`-X`, `--request`, `--method`; spaced, glued or in a
 *   bundle) whose value may write (see `methodWrites`);
 * - on an httpie line, a word built at run time that is not URL-shaped and
 *   has a word after it, which may be the method (`http "$M" <url>`);
 * - an option or an httpie item that sends a body.
 * @param {Word[]} args
 * @param {HttpClient} client
 */
function mayWrite(args, client) {
  return args.some((word, i) => {
    const { text } = word;
    const next = args[i + 1];
    if (ANY_METHOD.test(text) && !READ_METHOD.test(text)) return true;
    if (client.line && !text.startsWith('-')) {
      if (HTTPIE_BODY_ITEM.test(text)) return true;
      return word.dynamic && next !== undefined && !/[/.:=@]/.test(text);
    }
    const long = /^--(?<name>[\w-]+)(?:=(?<value>.*))?$/.exec(text)?.groups;
    if (long) {
      const name = long.name ?? '';
      if (client.longBody?.test(name)) return true;
      if (!client.longMethod.has(name)) return false;
      if (long.value !== undefined) return methodWrites({ ...word, text: long.value });
      return next !== undefined && methodWrites(next);
    }
    const bundle = /^-(?<letters>[a-zA-Z]+)(?<tail>.*)$/.exec(text)?.groups;
    if (!bundle) return false;
    // Up to the method letter, each letter may be a body option (a letter
    // that is really a glued value only adds a refusal); past it is the method.
    const letters = bundle.letters ?? '';
    const at = [...letters].findIndex((flag) => client.shortMethod.includes(flag));
    const before = at === -1 ? letters : letters.slice(0, at);
    if ([...before].some((flag) => client.shortBody.includes(flag))) return true;
    if (at === -1) return false;
    const value = (letters.slice(at + 1) + (bundle.tail ?? '')).replace(/^=/, '');
    if (value === '') return next !== undefined && methodWrites(next);
    return METHOD_SHAPED.test(value) && methodWrites({ ...word, text: value });
  });
}

/**
 * The words that stand where a URL goes, read with the client's option
 * tables: the words that are not options or option values, past `--` every
 * word, and `--url` values. On an httpie line, a method and the items are
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
    const long = /^--(?<name>[\w-]+)(?:=(?<value>.*))?$/.exec(text)?.groups;
    if (long) {
      const name = long.name ?? '';
      const glued = long.value;
      const taken =
        glued !== undefined
          ? takeValue(glued)
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
  if (!client.line) return positional;
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
  const name = /** @type {keyof typeof CLIENT_OF | undefined} */ (
    Object.hasOwn(CLIENT_OF, program) ? program : undefined
  );
  if (name === undefined) return null;
  const client = HTTP_CLIENTS[CLIENT_OF[name]];
  return { writes: mayWrite(args, client), urls: urlWords(args, client) };
}

/**
 * Whether a URL's host is built at run time from more than one variable, as
 * in `https://api.$D/...` or `api.github.c[o]m/...`. A port is not part of
 * the host (`localhost:$PORT`), and a host that is one variable
 * (`$API_URL/users`, `${API}/x`) is out of scope, like `curl -X PUT $URL`.
 * A word with no scheme and no `/` is not taken for a URL.
 * @param {string} text
 */
export function hasRunTimeHost(text) {
  const url = /^(?:(?<scheme>[a-z][\w+.-]*):\/\/)?(?<host>[^/]*)(?<slash>\/)?/i.exec(text)?.groups;
  if (!url || (url.scheme === undefined && url.slash === undefined)) return false;
  const host = (url.host ?? '').replace(/:(?:\d+|\$\w+|\$\{\w+\})$/, '');
  if (/^\$(?:\w+|\{\w+\})$/.test(host)) return false;
  return /[$`*?[{(]/.test(host);
}
