/* Generic on purpose. Neither `playwright` nor `vitest` resolves from the repo
   root, so a type import of either here would quietly become `any`. The
   caller's own modules fill in the types instead. */

type Engine = 'chromium' | 'webkit' | 'firefox';

export declare const BROWSER_BUDGET: number;

export declare function bootBrowser<
  TBrowser extends { close(): Promise<void> },
  TDescribe extends { skip: unknown },
>(
  label: string,
  options: {
    vitest: {
      afterAll: (fn: () => Promise<void>, timeout?: number) => void;
      describe: TDescribe;
    };
    playwright: () => Promise<Record<Engine, { launch(): Promise<TBrowser> }>>;
    engine?: Engine;
    budget?: number;
  },
): Promise<{ browser: TBrowser | null; describeBrowser: TDescribe }>;
