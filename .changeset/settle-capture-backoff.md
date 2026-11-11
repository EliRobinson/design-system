---
'@elirobinson/ai-patterns': patch
---

The visual sweeps' settle probe now retries Chromium's "Unable to capture screenshot" up to four times, with growing pauses (about 1.5s in all), instead of twice 100ms apart. The shot compared against the baseline is unchanged: Playwright's `toHaveScreenshot` already retries that error itself.
