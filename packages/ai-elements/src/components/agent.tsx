/*
 * Vendored from vercel/ai-elements. DO NOT EDIT BY HAND.
 *
 * Upstream:  https://github.com/vercel/ai-elements
 * Release:   ai-elements@1.9.0 (bc871264341cf54a7ea1fee36d951688ed2a1ff7)
 * Source:    packages/elements/src/agent.tsx
 * License:   Apache-2.0. See LICENSE and NOTICE at this package root.
 *
 * Local modifications, applied by scripts/ai-elements-transforms.mjs:
 *   - workspace-alias: rewrote @repo/shadcn-ui/* imports to paths inside this package
 *   - relative-extensions: appended .js to relative specifiers, so dist/ resolves under Node too
 *
 * Re-pull with `pnpm sync:elements`. An edit made here instead is detected
 * as local divergence and makes the next upstream bump fail loudly rather
 * than silently reverting your change.
 */
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion.js";
import { Badge } from "../ui/badge.js";
import { cn } from "../lib/utils.js";
import type { Tool } from "ai";
import { BotIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { memo } from "react";

import { CodeBlock } from "./code-block.js";

export type AgentProps = ComponentProps<"div">;

export const Agent = memo(({ className, ...props }: AgentProps) => (
  <div
    className={cn("not-prose w-full rounded-md border", className)}
    {...props}
  />
));

export type AgentHeaderProps = ComponentProps<"div"> & {
  name: string;
  model?: string;
};

export const AgentHeader = memo(
  ({ className, name, model, ...props }: AgentHeaderProps) => (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <BotIcon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{name}</span>
        {model && (
          <Badge className="font-mono text-xs" variant="secondary">
            {model}
          </Badge>
        )}
      </div>
    </div>
  )
);

export type AgentContentProps = ComponentProps<"div">;

export const AgentContent = memo(
  ({ className, ...props }: AgentContentProps) => (
    <div className={cn("space-y-4 p-4 pt-0", className)} {...props} />
  )
);

export type AgentInstructionsProps = ComponentProps<"div"> & {
  children: string;
};

export const AgentInstructions = memo(
  ({ className, children, ...props }: AgentInstructionsProps) => (
    <div className={cn("space-y-2", className)} {...props}>
      <span className="font-medium text-muted-foreground text-sm">
        Instructions
      </span>
      <div className="rounded-md bg-muted/50 p-3 text-muted-foreground text-sm">
        <p>{children}</p>
      </div>
    </div>
  )
);

export type AgentToolsProps = ComponentProps<typeof Accordion>;

export const AgentTools = memo(({ className, ...props }: AgentToolsProps) => (
  <div className={cn("space-y-2", className)}>
    <span className="font-medium text-muted-foreground text-sm">Tools</span>
    <Accordion className="rounded-md border" {...props} />
  </div>
));

export type AgentToolProps = ComponentProps<typeof AccordionItem> & {
  tool: Tool;
};

export const AgentTool = memo(
  ({ className, tool, value, ...props }: AgentToolProps) => {
    const schema =
      "jsonSchema" in tool && tool.jsonSchema
        ? tool.jsonSchema
        : tool.inputSchema;

    return (
      <AccordionItem
        className={cn("border-b last:border-b-0", className)}
        value={value}
        {...props}
      >
        <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
          {tool.description ?? "No description"}
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <div className="rounded-md bg-muted/50">
            <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" />
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
);

export type AgentOutputProps = ComponentProps<"div"> & {
  schema: string;
};

export const AgentOutput = memo(
  ({ className, schema, ...props }: AgentOutputProps) => (
    <div className={cn("space-y-2", className)} {...props}>
      <span className="font-medium text-muted-foreground text-sm">
        Output Schema
      </span>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={schema} language="typescript" />
      </div>
    </div>
  )
);

Agent.displayName = "Agent";
AgentHeader.displayName = "AgentHeader";
AgentContent.displayName = "AgentContent";
AgentInstructions.displayName = "AgentInstructions";
AgentTools.displayName = "AgentTools";
AgentTool.displayName = "AgentTool";
AgentOutput.displayName = "AgentOutput";
