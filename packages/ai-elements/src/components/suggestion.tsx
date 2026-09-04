/*
 * Vendored from vercel/ai-elements. DO NOT EDIT BY HAND.
 *
 * Upstream:  https://github.com/vercel/ai-elements
 * Release:   ai-elements@1.9.0 (bc871264341cf54a7ea1fee36d951688ed2a1ff7)
 * Source:    packages/elements/src/suggestion.tsx
 * License:   Apache-2.0. See LICENSE and NOTICE at this package root.
 *
 * Local modifications, applied by scripts/ai-elements-transforms.mjs:
 *   - workspace-alias: rewrote @repo/shadcn-ui/* imports to paths inside this package
 *
 * Re-pull with `pnpm sync:elements`. An edit made here instead is detected
 * as local divergence and makes the next upstream bump fail loudly rather
 * than silently reverting your change.
 */
"use client";

import { Button } from "../ui/button.js";
import {
  ScrollArea,
  ScrollBar,
} from "../ui/scroll-area.js";
import { cn } from "../lib/utils.js";
import type { ComponentProps } from "react";
import { useCallback } from "react";

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => (
  <ScrollArea className="w-full overflow-x-auto whitespace-nowrap" {...props}>
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
    <ScrollBar className="hidden" orientation="horizontal" />
  </ScrollArea>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
