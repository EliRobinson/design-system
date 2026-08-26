---
name: miltinson-design
description: Use this skill to generate well-branded interfaces and assets for Miltinson Technologies (the studio of Eli Robinson — builder, consultant, founder), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

<!-- ds-artifacts:managed:begin -->
<!-- Everything between these markers is replaced when this skill is packed for a
     consuming repo (packages/ai-patterns/scripts/build-artifacts.mjs). The copy below is
     the in-repo version; the consumer version names the subset that actually ships. -->

Read the README.md file within this skill, and explore the other available files (`colors_and_type.css`, `assets/`, `ui_kits/`, `slides/`, `preview/`).

The component library's documentation site lives at `apps/docs` in this repo (`pnpm nx run docs:dev`) — it documents every `@elirobinson/react` component with live demos and generated prop tables, and serves the machine-readable system description at `/llms.txt`, `/llms-full.txt`, and `/r/<component>.json`. When writing production code against the design system, prefer those generated references; this skill folder remains the source of truth for brand voice, assets, and visual direction.

If creating visual artifacts (slides, mocks, throwaway prototypes, marketing pages, etc),
copy assets out and create static HTML files for the user to view — always link `colors_and_type.css`
and use the wordmark from `assets/`. If working on production code, copy assets and read the
rules in README.md to become an expert in designing with the Miltinson brand.

<!-- ds-artifacts:managed:end -->

Key brand reminders:

- The voice is Miltinson Technologies; "I" or "we" is the product's call, held consistently within a surface
- Tone: practical, honest, warm, no-fluff
- Color: ink-led with **Miltinson Amber** as the only loud accent; Forest as the secondary anchor
- Type: Geist + JetBrains Mono
- Wordmark: "Miltinson." with the period (in amber)
- Tagline: "Builder. Consultant. Founder." or "Practical tech, honestly built."
- No gradients, no purple, no emoji in primary UI (emoji OK for the Kids Recipes sub-brand only)
- Sharp 4–6px radii, hairline borders, restrained shadows, calm motion
- Accessibility-first: 16px min, 44px touch, WCAG AA, focus-visible rings, reduced-motion honored

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (audience, surface, copy length, variations), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
