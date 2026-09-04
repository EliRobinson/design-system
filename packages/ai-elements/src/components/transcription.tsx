/*
 * Vendored from vercel/ai-elements. DO NOT EDIT BY HAND.
 *
 * Upstream:  https://github.com/vercel/ai-elements
 * Release:   ai-elements@1.9.0 (bc871264341cf54a7ea1fee36d951688ed2a1ff7)
 * Source:    packages/elements/src/transcription.tsx
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
"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { cn } from "../lib/utils.js";
import type { Experimental_TranscriptionResult as TranscriptionResult } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

type TranscriptionSegment = TranscriptionResult["segments"][number];

interface TranscriptionContextValue {
  segments: TranscriptionSegment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek?: (time: number) => void;
}

const TranscriptionContext = createContext<TranscriptionContextValue | null>(
  null
);

const useTranscription = () => {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error(
      "Transcription components must be used within Transcription"
    );
  }
  return context;
};

export type TranscriptionProps = Omit<ComponentProps<"div">, "children"> & {
  segments: TranscriptionSegment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  children: (segment: TranscriptionSegment, index: number) => ReactNode;
};

export const Transcription = ({
  segments,
  currentTime: externalCurrentTime,
  onSeek,
  className,
  children,
  ...props
}: TranscriptionProps) => {
  const [currentTime, setCurrentTime] = useControllableState({
    defaultProp: 0,
    onChange: onSeek,
    prop: externalCurrentTime,
  });

  const contextValue = useMemo(
    () => ({ currentTime, onSeek, onTimeUpdate: setCurrentTime, segments }),
    [currentTime, onSeek, setCurrentTime, segments]
  );

  return (
    <TranscriptionContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex flex-wrap gap-1 text-sm leading-relaxed",
          className
        )}
        data-slot="transcription"
        {...props}
      >
        {segments
          .filter((segment) => segment.text.trim())
          .map((segment, index) => children(segment, index))}
      </div>
    </TranscriptionContext.Provider>
  );
};

export type TranscriptionSegmentProps = ComponentProps<"button"> & {
  segment: TranscriptionSegment;
  index: number;
};

export const TranscriptionSegment = ({
  segment,
  index,
  className,
  onClick,
  ...props
}: TranscriptionSegmentProps) => {
  const { currentTime, onSeek } = useTranscription();

  const isActive =
    currentTime >= segment.startSecond && currentTime < segment.endSecond;
  const isPast = currentTime >= segment.endSecond;

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onSeek) {
        onSeek(segment.startSecond);
      }
      onClick?.(event);
    },
    [onSeek, segment.startSecond, onClick]
  );

  return (
    <button
      className={cn(
        "inline text-left",
        isActive && "text-primary",
        isPast && "text-muted-foreground",
        !(isActive || isPast) && "text-muted-foreground/60",
        onSeek && "cursor-pointer hover:text-foreground",
        !onSeek && "cursor-default",
        className
      )}
      data-active={isActive}
      data-index={index}
      data-slot="transcription-segment"
      data-touch-target="dense"
      onClick={handleClick}
      type="button"
      {...props}
    >
      {segment.text}
    </button>
  );
};
