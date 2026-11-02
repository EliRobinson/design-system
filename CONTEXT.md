# Miltinson Design System

The tokens, components and agent tooling that product apps build on. This file is the glossary. It holds words, not rules.

## The system

**Token**:
A named design value (a colour, space, radius, type size) published by `@elirobinson/tokens`.
_Avoid_: variable, style constant

**Palette**:
A whole brand's set of colour ramps, picked with `data-palette`. Miltinson Amber is the default.
_Avoid_: theme, skin

**Product token layer**:
The optional `--product-*` slots a consumer may set in its own scope. Each one falls back to a system token.
_Avoid_: product tokens, overrides

**Tier**:
The folder a component lives in by how much it assembles: atoms, molecules, organisms. The `ai` tier groups by purpose instead.
_Avoid_: level, layer

**Brand boundary**:
The line between what the system ships (inert until chosen, or true under every brand) and what a consumer holds.
_Avoid_: brand rules

**Consumer**:
An app that installs our packages. It bumps a version and is current.
_Avoid_: client, user

## The vendored tier

**AI Elements**:
The components vendored from `vercel/ai-elements` at a pinned release. Our source never edits them by hand.
_Avoid_: AI components

**Family**:
A group of AI Elements documented together on one docs page.
_Avoid_: category, group

## How we work

**Coordinator**:
The one chat Eli talks to. It plans and dispatches the other agents.
_Avoid_: orchestrator, lead agent

**Lane**:
One agent's issue, worktree, branch and owned files.
_Avoid_: track, stream

**Review gate**:
The four read-only reviewers that must run before a PR opens.
_Avoid_: PR review, checks

**Ask**:
One thing Eli must do, decide or approve, kept on his Asks board.
_Avoid_: request, ping
