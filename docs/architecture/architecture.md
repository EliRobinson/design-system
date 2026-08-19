# AI-Native Design System: Shared Architecture Decisions

**Status:** Shared understanding confirmed  
**Date:** 2026-08-15  
**Scope:** A governed design-system platform for people and AI agents, enabling high-fidelity prototypes through production applications.

## Vision

Build an AI-native design system as an executable, governed source of truth for human builders, application code, and agents. It must support highly autonomous but bounded creation while preserving brand consistency, accessibility, localization, security, maintainability, and upgradeability.

The platform bridges constrained “vibe coding” to governed delivery. Freeform generation is useful in a sandbox, but promotion requires approved patterns, structured manifests, validated components, policy enforcement, and accountable human approval.

## Product model

### Audience and operating model

- Shared platform for internal product teams, non-technical builders, and potential external use
- Sequence delivery from an internal, production-grade foundation to governed builder experiences
- Support greenfield development and legacy modernization through compatibility layers, migration paths, and codemods
- Support flexible organizational ownership models, provided decision rights and accountable owners are explicit

### Promotion tiers

1. **Draft:** Exploratory work with mock or synthetic data
2. **Prototype:** High-fidelity sandbox output; may include freeform experimentation but cannot be promoted unaltered
3. **Governed internal app:** Approved patterns, restricted connectors, policy gates, and accountable ownership
4. **Production candidate:** Complete evidence, required reviews, progressive delivery controls, and release approval

## Quality baseline

### Accessibility

- Production target: **WCAG 2.2 AA**
- Enforce accessibility in both component-library and application CI
- Combine automated testing, visual review, runtime safeguards, and knowledgeable human review for applicable flows
- Support semantic HTML, keyboard operation, focus management, accessible names/descriptions, screen-reader announcements, validation/error behavior, pointer/touch alternatives, and appropriate ARIA patterns
- Explicitly cover high-risk patterns including combobox/autocomplete, date picker, data grid, drag alternatives, live messaging, file upload, multi-step forms, and authenticated flows
- Prefer native controls where sufficient; custom ARIA patterns require specified keyboard behavior and test evidence

### Internationalization and localization

- Initial locales: `en-US` and Mexican Spanish, `es-MX`
- Treat `es-MX` as a distinct localized experience, not a generic Spanish translation
- Externalize, contextualize, version, and review all user-facing strings
- Use ICU/CLDR-backed formatting for dates, time, numbers, currency, units, and plurals
- Require locale-safe layout behavior: text expansion, plural/gender forms, truncation handling, locale formats, and content variants
- Be ready for RTL, directionality, locale-specific calendars/numerals, and cultural-content requirements
- Use AI for translation drafts only; designated human reviewers approve published customer-facing translations

### Themes, motion, and content

- Support light and dark modes from the start, with system-preference support and a persisted user override
- Use semantic color roles, never light-theme inversion or raw color values in product code
- Provide motion tokens, standardized interaction states, reduced-motion equivalents, and a small governed choreography catalog
- Govern UI content through tone/voice, terminology, UI-string schemas, message taxonomy, error/recovery content, localization context, and inclusive-language guidance

## System architecture

### Artifact model

- Author in a monorepo and publish through a unified, versioned registry
- Registry artifacts include tokens, components, schemas, patterns, templates, documentation, examples, machine-readable agent context, tests, provenance, release metadata, and migration information
- Every artifact includes semantic version, lifecycle status, dependencies, supported modes/locales, accessibility status, provenance, and migration guidance
- Use semantic versioning, deprecation windows, automated compatibility checks, codemods, and migration guides

### Token architecture

Use a deterministic layered model:

1. **Reference tokens:** Raw foundational scales and values; restricted to the token foundation
2. **Semantic tokens:** Intent-based roles, such as text, surface, border, status, and focus roles
3. **Component tokens:** Component-specific semantic aliases, such as button or dialog roles

Support contextual modes for brand, light/dark scheme, density, contrast, locale, and platform. Product code and agents consume semantic/component tokens, never arbitrary visual values. Use the stable Design Tokens Community Group format for portable interchange.

### Components and layout

- Build on accessible primitives internally
- Expose opinionated components, patterns, templates, and layout recipes as the default authoring surface for teams, builders, and agents
- Reserve low-level primitives for system/pattern authors
- Use named responsive recipes with constrained slots for application shells, forms, list/detail, dashboards, onboarding, authentication, approvals, search/filter, destructive actions, and loading/empty/error states
- Do not allow unbounded generated CSS or arbitrary production layouts as the normal path

### Durable generated artifacts

Use a hybrid model:

- A versioned declarative manifest for standard screens and workflows
- Compilation/rendering into React and TypeScript
- Clearly bounded handwritten or generated extension points behind typed interfaces

The manifest enables validation, deterministic rendering, migrations, safe low-code authoring, analytics, and policy enforcement. Extensions preserve expressive power without undermining upgradeability or governance.

### Reference stack

- Initial runtime: Responsive web
- Initial implementation: React + TypeScript
- Keep tokens and structured specifications platform-neutral for later mobile, multi-framework, and other-platform expansion
- Synchronize tokens automatically between design tools and code first; increase component metadata synchronization selectively

## Governance

### Required decision rights

Regardless of organization shape, assign an accountable owner and backup for:

- Foundation stewardship: Token architecture, primitives, quality baseline, releases
- Domain stewardship: Product patterns, extensions, feedback
- Accessibility authority: WCAG policy, review thresholds, exception decisions
- Content and locale authority: Source content, terminology, translation review
- AI policy authority: Permissions, tools, audit, escalation
- Release authority: Publishing, deprecation, rollback, breaking changes

### Extensions

- Domain teams may create incubator patterns when approved components do not meet a need
- Every incubator artifact has an owner, expiry date, usage telemetry, and promotion/replacement/retirement decision
- Avoid permanent, silent forks and untracked wrappers

### Promotion evidence

Production artifacts and generated applications require, as applicable:

- Schema and component/API validation
- Type, lint, build, and test success
- Responsive visual-regression evidence
- Light/dark mode validation
- `en-US` and `es-MX` validation
- Automated accessibility checks and manual accessibility review
- Security and data-policy review
- Accountable owner approval

## AI architecture

### Context gateway

Use a versioned context gateway as the authoritative interface for agent context and governed actions. It resolves project, design-system version, actor identity, and promotion tier before returning resources or allowing tools to execute.

Gateway capabilities:

- Versioned token, component, schema, pattern, and template lookup
- Structured search and policy lookup
- Typed validation tools
- Controlled delivery actions: branches, manifests, previews, test runs, draft pull requests
- Identity, authorization, quotas, audit logs, and tenant/project/environment isolation
- Provenance and telemetry capture

Implement interoperable interfaces with MCP where useful, while retaining an independent authorization and policy layer. Use short-lived, scoped authorization and never expose raw credentials to agents.

### RAG boundary

Use permission-aware RAG as a supporting layer for human-oriented explanatory material:

- ADRs and rationale
- Design research and content guidance
- Migration notes and deprecation explanations
- Approved examples and troubleshooting

Do not use RAG as the canonical source for current APIs, token values, component variants, permissions, or validation rules. Structured registry data and gateway responses are authoritative.

### Agent roadmap

Stage capabilities by risk:

1. Knowledge assistant
2. Governed UI composer
3. Bounded code contributor
4. Supervised design-system maintainer

Human interaction is chat plus an inspectable visual canvas, constrained property editing, visible manifest/code diffs, and reviewable evidence.

### Agent behavior

- Select approved patterns, components, tokens, and localization resources
- Do not invent production primitives, APIs, raw styling values, or policy exceptions
- Generate evidence proportional to promotion tier and interaction risk
- Create branches, previews, and draft PRs within scoped permissions
- Do not independently publish shared foundations or promote production changes
- On uncertainty, conflicts, missing patterns, or failed validation: produce a clearly labeled prototype/proposal, enumerate unresolved constraints, suggest valid next actions, and block promotion

### Evaluation and learning

- Maintain a versioned evaluation corpus of representative tasks, golden manifests/code, objective validation outcomes, and scored human review
- Measure compliance, accessibility, visual fidelity, task success, edit burden, unsupported-invention rate, cost, and latency
- Store authorized and privacy-protected proposal-to-approved diffs, validation failures, reviewer feedback, and aggregate usage outcomes
- Use feedback first for retrieval, examples, policies, and evaluations—not uncontrolled automatic retraining

## Security, data, and operations

### Isolation and data policy

- Architect for long-term multi-tenancy; initially enforce organization/project/environment isolation
- Carry tenant, project, environment, actor, agent, and artifact identity through retrieval, tools, connectors, logs, and policy decisions
- Apply tiered data classification by model, task, region, tenant, retention period, and promotion tier
- Default prototypes to synthetic or masked data
- Redact and minimize context before model calls; enforce retention and deletion controls

### Model gateway

- Begin with a preferred model provider but use a provider-neutral internal interface
- Standardize structured output, tool use, policy, tracing, evaluations, costs, and fallback behavior
- Evolve to task-based multi-model routing only after evaluation evidence justifies it

### Security controls

- Treat retrieved documents, webpages, tickets, design files, and data records as untrusted content, never as authority to redefine policy
- Enforce tool-level authorization, least privilege, secret isolation, input/output controls, quotas, approval gates, and environment separation
- Conduct adversarial testing for prompt injection, excessive agency, unsafe tool use, sensitive-data disclosure, and supply-chain risk

### Audit and observability

Retain privacy-minimized reproducibility records for consequential actions:

- User intent and actor identity
- System, policy, and artifact versions
- Retrieved artifact IDs
- Model identity/version
- Tool calls and validation results
- Output references, approvals, and deployment linkage

Do not retain hidden chain-of-thought. Use redaction, access controls, retention schedules, and deletion policies. Instrument model and tool behavior using adaptable OpenTelemetry-aligned traces, metrics, and events.

### Delivery and rollback

- Build immutable, version-pinned artifacts
- Provide preview environments and feature flags
- Use canary/progressive rollout and observability gates
- Make rollback immediate, traceable, and reproducible
- Automated checks inform release decisions; accountable release approval remains required

## Adoption and measurement

### Adoption model

- Make the governed path the fastest and most rewarding path through excellent templates, support, documentation, agent workflows, and visible benefits
- Require reviewable exceptions and track ungoverned UI
- Hard-block only high-risk accessibility, security, data, or policy violations

### Balanced scorecard

Measure baseline and progress across:

- Adoption: Approved artifact usage, teams/projects, upgrade lag
- Delivery: Intent-to-preview time, intent-to-merged-change time
- Quality: Accessibility defects, visual regressions, localization defects, policy violations, incidents
- Builder experience: Edit burden, approval friction, satisfaction, successful task completion
- Agent performance: Validation-pass rate, unsupported-invention rate, evaluation scores, escalation frequency
- Platform health: Reliability, component/pattern reuse, extension lifecycle outcomes
- Cost: Model, infrastructure, support, and human-review cost
- Product outcomes: User/task outcomes where attribution is credible

## Standards and implementation anchors

- Target WCAG 2.2 AA
- Use the Design Tokens Community Group stable 2025.10 format for interoperable token exchange
- Use MCP resources/tools where appropriate for agent interoperability, with separate policy and authorization enforcement
- Use ICU/CLDR-backed internationalization capabilities for locale-sensitive UI behavior

## Confirmation

Shared understanding was confirmed on 2026-08-15. This document records the agreed architectural direction; implementation planning begins after this confirmation.
