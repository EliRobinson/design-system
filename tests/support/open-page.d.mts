/* Generic on purpose, like boot-browser.d.mts: `playwright` is not a
   dependency of the repo root, so the caller's own Browser fills in the page
   and context types. */

export declare function openPage<TContextOptions, TPage, TResult>(
  browser: {
    newContext(
      options?: TContextOptions,
    ): Promise<{ newPage(): Promise<TPage>; close(): Promise<void> }>;
  },
  options: {
    origin: string;
    html: string;
    files?: Record<string, string>;
    fallbackDir: string;
    context?: TContextOptions;
  },
  run: (page: TPage) => Promise<TResult> | TResult,
): Promise<TResult>;
