# Invoice & receipt

Two printable documents built on `<doc-page>`, so Save-as-PDF produces a clean sheet with no browser chrome.

- `invoice.html` — full B2B invoice: from/billed-to, line items with dates, subtotal → VAT → payments → balance, payment and terms blocks.
- `receipt.html` — narrow customer receipt, emailable, download-oriented.

**Rules**

- **No colour except the wordmark dot.** Print is ink on paper; a coloured invoice reads as a marketing email.
- **Every figure is mono and right-aligned**, and the currency is written out at least once.
- **Rules carry the hierarchy:** a full-ink rule under the header, the table head and the grand total; hairlines between line items.
- **The totals stack always shows what was already paid** and ends with a balance, even when it's $0.00.
- **Terms restate the brand promise in plain words** — "no contracts required", "refunds within 30 days, no argument".

**`doc-page.js` is vendored, not ours.** It is the Claude Design starter scaffold for paged documents, copied in verbatim so these two files render standalone. It carries its own `@ds-adherence-ignore` marker because it uses raw elements, hex and px by design. Don't edit it here and don't treat it as part of the design system — re-copy it from the design project if it needs updating.
