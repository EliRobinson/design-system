/*
 * Vendored from vercel/ai-elements. DO NOT EDIT BY HAND.
 *
 * Upstream:  https://github.com/vercel/ai-elements
 * Release:   ai-elements@1.9.0 (bc871264341cf54a7ea1fee36d951688ed2a1ff7)
 * Source:    packages/shadcn-ui/components/ui/accordion.tsx
 * License:   Apache-2.0. See LICENSE and NOTICE at this package root.
 *
 * Local modifications, applied by scripts/ai-elements-transforms.mjs:
 *   - workspace-alias: rewrote @repo/shadcn-ui/* imports to paths inside this package
 *   - a11y-touch-targets: applied the design system touch-target contracts — a var(--target) floor for primary controls, and a data-touch-target="dense" classification for compact inline affordances (see scripts/ai-elements-patches/a11y.mjs for the per-control verdicts)
 *
 * Re-pull with `pnpm sync:elements`. An edit made here instead is detected
 * as local divergence and makes the next upstream bump fail loudly rather
 * than silently reverting your change.
 */
"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "../lib/utils.js"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 min-h-[var(--target)] items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
