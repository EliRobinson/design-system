/* Generic on purpose. Neither `playwright` nor `vitest` is a dependency of the
   repo root, so a type import of either here resolves by luck of hoisting or
   not at all, and quietly becomes `any`. The caller's own modules fill in the
   types instead. */

export type Engine = 'chromium' | 'webkit' | 'firefox';

export declare const BROWSER_BUDGET: number;

export declare const ENGINES: readonly Engine[];

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
    launchBudget?: number;
  },
): Promise<{ browser: TBrowser | null; describeBrowser: TDescribe }>;
