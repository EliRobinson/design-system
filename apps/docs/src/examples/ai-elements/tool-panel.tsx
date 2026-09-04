'use client';

/**
 * The other end of the display metadata: a tool panel that leads with a phrase.
 *
 * `ToolHeader` takes a `title`, and without one it renders the tool's `type` —
 * `tool-searchCatalogue`. `toolDisplayName` is the function that never returns
 * an identifier: it reads the manifest the route built, and falls back to a
 * humanised form of the name for a tool nobody labelled.
 *
 * `getToolName` is the SDK's, and it is the piece that makes the two agree: the
 * manifest is keyed by the name the tool set was declared under, and a UI part's
 * `type` is that name with a `tool-` prefix.
 *
 * The manifest arrives as a prop rather than as an import from the route
 * module. That is the whole reason `toolDisplayManifest` returns plain JSON:
 * importing the route here would pull the tools' schemas and their `execute`
 * functions into the client bundle. Pass it down from a server component, or
 * serve it from a route of its own — either way what crosses is data.
 *
 * `isStaticToolUIPart` rather than `isToolUIPart`: this panel renders the tools
 * the route declared. A dynamic tool — one an MCP server supplied at run time —
 * carries its name in a `toolName` field instead, and is not in the manifest, so
 * `toolDisplayName` would label it from its name. Handle those in a second
 * branch when you have them.
 */

import { getToolName, isStaticToolUIPart, type UIMessage } from 'ai';

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@elirobinson/ai-elements/components/tool';
import { toolDisplayName, type ToolDisplayManifest } from '@elirobinson/ai-patterns/server/tools';

export function MessageTools({
  message,
  display,
}: {
  message: UIMessage;
  display: ToolDisplayManifest;
}) {
  return (
    <>
      {message.parts.filter(isStaticToolUIPart).map((part) => (
        <Tool key={part.toolCallId}>
          <ToolHeader
            state={part.state}
            title={toolDisplayName(display, getToolName(part))}
            type={part.type}
          />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput errorText={part.errorText} output={part.output} />
          </ToolContent>
        </Tool>
      ))}
    </>
  );
}
