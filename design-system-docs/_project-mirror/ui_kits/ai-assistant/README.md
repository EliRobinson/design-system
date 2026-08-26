# AI assistant kit

The brand's answer to a chat bot: honest, quiet, ink-on-white. No purple gradients, no bubble chrome, no avatars-with-personality.

Rules this kit encodes:

- **Speakers are marks, not bubbles.** Each turn carries a hairline-outlined avatar mark and a name; messages are left-aligned in one column — no chat-bubble tails. The kit calls `ChatThread` / `ChatMessage` / `StreamingCaret` from `@elirobinson/react`'s `ai` tier with their shipped props, so what it renders is what the package renders. `ChatComposer` and `PromptSuggestions` are still the project's own.
- **Amber is the only motion.** The streaming caret is `--accent-press` (`--accent` is 2.53:1 and misses SC 1.4.11); nothing else animates, and it stops under `prefers-reduced-motion` without disappearing.
- **Every claim can be traced.** Assistant turns carry numbered citation chips that open the Sources sheet.
- **The honesty footnote is a contract.** “AI can be wrong — check anything that matters” sits under every composer. Don't remove it.
- **Empty state does the selling.** Starter prompts, one sentence on what it knows, one on what it doesn't.

Type `⏎` to send, `⇧⏎` for a newline. The streamed answer is canned.
