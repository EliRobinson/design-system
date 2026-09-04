/* One realistic mount per vendored component, keyed by the component's name in
 * `@elirobinson/ai-elements/manifest`.
 *
 * The spec reads its roster off that manifest rather than off this file, so a
 * component upstream adds arrives in the sweep by itself and arrives *failing*:
 * the harness reports "no fixture named …" as a fixture error, and the first
 * assertion in the spec is on that. Nothing here has to be kept in step by
 * hand.
 *
 * Every fixture imports through the package's published subpaths rather than
 * through `../../src`, so what is measured is what a consumer installs.
 *
 * Fixtures render the composition a consumer would write, not the smallest
 * thing that mounts. A `<Message>` with no `<MessageActions>` has no controls
 * in it, and a touch-target sweep over it reports a clean pass — which is how
 * an audit ends up green without having looked at anything. Where a
 * component's controls exist only in an open state (a collapsible, a dropdown,
 * a dialog), the fixture opens it.
 */
import { jsonSchema, tool } from 'ai';
import { CopyIcon, GlobeIcon, MicIcon, PlusIcon, RefreshCcwIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from '@elirobinson/ai-elements/components/agent';
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from '@elirobinson/ai-elements/components/artifact';
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@elirobinson/ai-elements/components/attachments';
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
} from '@elirobinson/ai-elements/components/audio-player';
import { Canvas } from '@elirobinson/ai-elements/components/canvas';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from '@elirobinson/ai-elements/components/chain-of-thought';
import { Checkpoint, CheckpointTrigger } from '@elirobinson/ai-elements/components/checkpoint';
import { CodeBlock, CodeBlockCopyButton } from '@elirobinson/ai-elements/components/code-block';
import {
  Commit,
  CommitActions,
  CommitContent,
  CommitCopyButton,
  CommitFile,
  CommitFileInfo,
  CommitFilePath,
  CommitFiles,
  CommitHeader,
  CommitMessage,
} from '@elirobinson/ai-elements/components/commit';
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@elirobinson/ai-elements/components/confirmation';
import { Connection } from '@elirobinson/ai-elements/components/connection';
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from '@elirobinson/ai-elements/components/context';
import { Controls } from '@elirobinson/ai-elements/components/controls';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@elirobinson/ai-elements/components/conversation';
import { Edge } from '@elirobinson/ai-elements/components/edge';
import {
  EnvironmentVariable,
  EnvironmentVariableCopyButton,
  EnvironmentVariableName,
  EnvironmentVariableValue,
  EnvironmentVariables,
  EnvironmentVariablesContent,
  EnvironmentVariablesHeader,
  EnvironmentVariablesTitle,
  EnvironmentVariablesToggle,
} from '@elirobinson/ai-elements/components/environment-variables';
import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from '@elirobinson/ai-elements/components/file-tree';
import { Image } from '@elirobinson/ai-elements/components/image';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationText,
} from '@elirobinson/ai-elements/components/inline-citation';
import { JSXPreview } from '@elirobinson/ai-elements/components/jsx-preview';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageToolbar,
} from '@elirobinson/ai-elements/components/message';
import {
  MicSelector,
  MicSelectorContent,
  MicSelectorItem,
  MicSelectorList,
  MicSelectorTrigger,
  MicSelectorValue,
} from '@elirobinson/ai-elements/components/mic-selector';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@elirobinson/ai-elements/components/model-selector';
import {
  Node,
  NodeContent,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from '@elirobinson/ai-elements/components/node';
import {
  OpenIn,
  OpenInChatGPT,
  OpenInClaude,
  OpenInContent,
  OpenInLabel,
  OpenInTrigger,
} from '@elirobinson/ai-elements/components/open-in-chat';
import {
  PackageInfo,
  PackageInfoContent,
  PackageInfoDescription,
  PackageInfoHeader,
  PackageInfoName,
  PackageInfoVersion,
} from '@elirobinson/ai-elements/components/package-info';
import { Panel } from '@elirobinson/ai-elements/components/panel';
import { Persona } from '@elirobinson/ai-elements/components/persona';
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from '@elirobinson/ai-elements/components/plan';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@elirobinson/ai-elements/components/prompt-input';
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from '@elirobinson/ai-elements/components/queue';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@elirobinson/ai-elements/components/reasoning';
import {
  Sandbox,
  SandboxContent,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsList,
  SandboxTabsTrigger,
} from '@elirobinson/ai-elements/components/sandbox';
import {
  SchemaDisplay,
  SchemaDisplayBody,
  SchemaDisplayContent,
  SchemaDisplayDescription,
  SchemaDisplayHeader,
} from '@elirobinson/ai-elements/components/schema-display';
import { Shimmer } from '@elirobinson/ai-elements/components/shimmer';
import {
  Snippet,
  SnippetCopyButton,
  SnippetInput,
} from '@elirobinson/ai-elements/components/snippet';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@elirobinson/ai-elements/components/sources';
import { SpeechInput } from '@elirobinson/ai-elements/components/speech-input';
import {
  StackTrace,
  StackTraceActions,
  StackTraceContent,
  StackTraceCopyButton,
  StackTraceHeader,
} from '@elirobinson/ai-elements/components/stack-trace';
import { Suggestion, Suggestions } from '@elirobinson/ai-elements/components/suggestion';
import { Task, TaskContent, TaskItem, TaskTrigger } from '@elirobinson/ai-elements/components/task';
import {
  Terminal,
  TerminalActions,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@elirobinson/ai-elements/components/terminal';
import {
  Test,
  TestResults,
  TestResultsContent,
  TestResultsHeader,
  TestSuite,
  TestSuiteContent,
} from '@elirobinson/ai-elements/components/test-results';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@elirobinson/ai-elements/components/tool';
import { Toolbar } from '@elirobinson/ai-elements/components/toolbar';
import { Button } from '@elirobinson/ai-elements/ui/button';
import {
  Transcription,
  TranscriptionSegment,
} from '@elirobinson/ai-elements/components/transcription';
import {
  VoiceSelector,
  VoiceSelectorContent,
  VoiceSelectorItem,
  VoiceSelectorList,
  VoiceSelectorName,
  VoiceSelectorTrigger,
} from '@elirobinson/ai-elements/components/voice-selector';
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from '@elirobinson/ai-elements/components/web-preview';

/* Several upstream components type their props as the DOM element they happen
 * to render — `ComponentProps<"div">` — while forwarding everything to a Radix
 * root underneath. `defaultOpen` is then a real, load-bearing prop that the
 * declared type does not admit. Recorded in the audit as an upstream typing
 * gap; here it is spread rather than hand-waved with `any`, so the day upstream
 * fixes the type nothing in this file has to change. */
const open = { defaultOpen: true } as Record<string, unknown>;

/* React Flow node types have to be module-level values: re-creating the map on
 * every render remounts every node, and the canvas warns about it. */
const CustomNode = () => (
  <Node handles={{ source: true, target: true }}>
    <NodeHeader>
      <NodeTitle>Build</NodeTitle>
      <NodeDescription>Compiles the package.</NodeDescription>
    </NodeHeader>
    <NodeContent>tsc -p ./tsconfig.json</NodeContent>
  </Node>
);

const ToolbarNode = () => (
  <>
    <Toolbar isVisible>
      <Button size="icon-sm" variant="ghost">
        <CopyIcon className="size-4" />
      </Button>
      <Button size="icon-sm" variant="ghost">
        <RefreshCcwIcon className="size-4" />
      </Button>
    </Toolbar>
    <Node handles={{ source: true, target: true }}>
      <NodeHeader>
        <NodeTitle>Build</NodeTitle>
      </NodeHeader>
    </Node>
  </>
);

export const fixtures: Record<string, ComponentType> = {
  agent: () => (
    <Agent>
      <AgentHeader name="Reviewer" />
      <AgentContent>
        <AgentInstructions>Review the diff and report what changed.</AgentInstructions>
        <AgentTools defaultValue={['read_file']} type="multiple">
          <AgentTool
            tool={tool({
              description: 'Read a file',
              inputSchema: jsonSchema({
                properties: { path: { type: 'string' } },
                required: ['path'],
                type: 'object',
              }),
            })}
            value="read_file"
          />
        </AgentTools>
      </AgentContent>
    </Agent>
  ),

  artifact: () => (
    <Artifact>
      <ArtifactHeader>
        <div>
          <ArtifactTitle>Release notes</ArtifactTitle>
          <ArtifactDescription>Draft, 2 revisions</ArtifactDescription>
        </div>
        <ArtifactActions>
          <ArtifactAction icon={CopyIcon} label="Copy" tooltip="Copy" />
          <ArtifactAction icon={RefreshCcwIcon} label="Regenerate" tooltip="Regenerate" />
          <ArtifactClose />
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent>The 1.9.0 release moves the toolbar above the composer.</ArtifactContent>
    </Artifact>
  ),

  /* The `list` variant, fully composed. The grid default renders a 96px tile
     whose contents are all opt-in — no preview, no name, and an
     <AttachmentRemove> that returns null without an `onRemove` — so the
     obvious mount is an empty box with nothing for the sweep to measure. */
  attachments: () => (
    <Attachments variant="list">
      <Attachment
        data={{
          filename: 'diagram.png',
          id: 'a1',
          mediaType: 'image/png',
          type: 'file',
          url: '',
        }}
        onRemove={() => {}}
      >
        <AttachmentPreview />
        <AttachmentInfo showMediaType />
        <AttachmentRemove />
      </Attachment>
    </Attachments>
  ),

  'audio-player': () => (
    <AudioPlayer>
      <AudioPlayerElement src="data:audio/mpeg;base64," />
      <AudioPlayerControlBar>
        <AudioPlayerPlayButton />
        <AudioPlayerMuteButton />
        <AudioPlayerTimeRange />
        <AudioPlayerTimeDisplay />
      </AudioPlayerControlBar>
    </AudioPlayer>
  ),

  canvas: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas
        edges={[{ id: 'a-b', source: 'a', target: 'b' }]}
        nodes={[
          { data: { label: 'Plan' }, id: 'a', position: { x: 0, y: 0 } },
          { data: { label: 'Build' }, id: 'b', position: { x: 220, y: 80 } },
        ]}
      />
    </div>
  ),

  'chain-of-thought': () => (
    <ChainOfThought {...open}>
      <ChainOfThoughtHeader>Working through it</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <ChainOfThoughtStep label="Read the contract" status="complete" />
        <ChainOfThoughtStep label="Measure the control" status="active" />
      </ChainOfThoughtContent>
    </ChainOfThought>
  ),

  checkpoint: () => (
    <Checkpoint>
      <CheckpointTrigger>Restore this checkpoint</CheckpointTrigger>
    </Checkpoint>
  ),

  'code-block': () => (
    <CodeBlock code={'const target = 44;\nexport { target };'} language="ts">
      <CodeBlockCopyButton />
    </CodeBlock>
  ),

  commit: () => (
    <Commit>
      <CommitHeader>
        <CommitMessage>Raise the dense floor to 24x24</CommitMessage>
        <CommitActions>
          <CommitCopyButton hash="bc87126" />
        </CommitActions>
      </CommitHeader>
      <CommitContent>
        <CommitFiles>
          <CommitFile>
            <CommitFileInfo>
              <CommitFilePath>packages/tokens/src/tokens.css</CommitFilePath>
            </CommitFileInfo>
          </CommitFile>
        </CommitFiles>
      </CommitContent>
    </Commit>
  ),

  /* `approval` is not optional in practice: <Confirmation> returns null
     without one, so a fixture that omits it renders nothing and every check in
     the sweep passes over an empty page — the exact false green this file's
     header warns about. */
  confirmation: () => (
    <Confirmation approval={{ id: 'call-1' }} state="approval-requested">
      <ConfirmationRequest>
        <ConfirmationTitle>Run the migration?</ConfirmationTitle>
        <ConfirmationActions>
          <ConfirmationAction>Run it</ConfirmationAction>
          <ConfirmationAction variant="outline">Cancel</ConfirmationAction>
        </ConfirmationActions>
      </ConfirmationRequest>
    </Confirmation>
  ),

  /* `Connection` is a React Flow `connectionLineComponent`: it is mounted by the
   * canvas and paints only while a pointer is mid-drag between two handles, so
   * there is nothing on screen at rest and no control of any kind. Wired the way
   * a consumer wires it, so the fixture is honest about what it is — the audit
   * records the verdict as vacuous rather than as a pass. */
  connection: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas
        connectionLineComponent={Connection}
        edges={[]}
        nodes={[{ data: { label: 'Plan' }, id: 'a', position: { x: 0, y: 0 } }]}
      />
    </div>
  ),

  context: () => (
    <Context
      {...open}
      maxTokens={200_000}
      usage={{
        inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 900 },
        inputTokens: 900,
        outputTokenDetails: { reasoningTokens: 0, textTokens: 300 },
        outputTokens: 300,
        totalTokens: 1200,
      }}
      usedTokens={1200}
    >
      <ContextTrigger />
      <ContextContent>
        <ContextContentHeader />
        <ContextContentBody>
          <ContextInputUsage />
          <ContextOutputUsage />
        </ContextContentBody>
      </ContextContent>
    </Context>
  ),

  /* React Flow's `Controls` reads the canvas store, so it throws outside a
   * provider. Mounted the only way it can be. */
  controls: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas edges={[]} nodes={[]}>
        <Controls />
      </Canvas>
    </div>
  ),

  conversation: () => (
    <div style={{ height: 320 }}>
      <Conversation>
        <ConversationContent>
          <ConversationEmptyState description="Ask something to begin." title="No messages" />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  ),

  /* `Edge` is not a component but the two edge *types* React Flow renders, so
   * it can only be mounted through a canvas that registers them. */
  edge: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas
        edgeTypes={{ animated: Edge.Animated, temporary: Edge.Temporary }}
        edges={[{ id: 'a-b', source: 'a', target: 'b', type: 'animated' }]}
        nodes={[
          { data: { label: 'Plan' }, id: 'a', position: { x: 0, y: 0 } },
          { data: { label: 'Build' }, id: 'b', position: { x: 220, y: 80 } },
        ]}
      />
    </div>
  ),

  'environment-variables': () => (
    <EnvironmentVariables>
      <EnvironmentVariablesHeader>
        <EnvironmentVariablesTitle>Environment</EnvironmentVariablesTitle>
        <EnvironmentVariablesToggle />
      </EnvironmentVariablesHeader>
      <EnvironmentVariablesContent>
        <EnvironmentVariable name="API_URL" value="https://example.com">
          <EnvironmentVariableName />
          <EnvironmentVariableValue />
          <EnvironmentVariableCopyButton />
        </EnvironmentVariable>
      </EnvironmentVariablesContent>
    </EnvironmentVariables>
  ),

  'file-tree': () => (
    <FileTree>
      <FileTreeFolder name="packages" path="packages">
        <FileTreeFile name="tokens.css" path="packages/tokens/src/tokens.css" />
      </FileTreeFolder>
    </FileTree>
  ),

  image: () => (
    <Image
      alt="A one-pixel placeholder"
      base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
      mediaType="image/png"
      uint8Array={new Uint8Array()}
    />
  ),

  'inline-citation': () => (
    <p>
      <InlineCitation>
        <InlineCitationText>Target Size (Minimum) is 24 by 24.</InlineCitationText>
        <InlineCitationCard {...open}>
          <InlineCitationCardTrigger sources={['https://example.com/wcag']} />
          <InlineCitationCardBody>
            <InlineCitationCarousel>
              <InlineCitationCarouselHeader>
                <InlineCitationCarouselPrev />
                <InlineCitationCarouselNext />
              </InlineCitationCarouselHeader>
              <InlineCitationCarouselContent>
                <InlineCitationCarouselItem>
                  <InlineCitationQuote>Targets are at least 24 by 24.</InlineCitationQuote>
                </InlineCitationCarouselItem>
              </InlineCitationCarouselContent>
            </InlineCitationCarousel>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
    </p>
  ),

  'jsx-preview': () => <JSXPreview jsx={'<div className="p-4">Preview</div>'} />,

  message: () => (
    <Message from="assistant">
      <MessageContent>The dense floor is 24 by 24, and it is a floor.</MessageContent>
      <MessageToolbar>
        <MessageActions>
          <MessageAction label="Copy" tooltip="Copy">
            <CopyIcon className="size-4" />
          </MessageAction>
          <MessageAction label="Regenerate" tooltip="Regenerate">
            <RefreshCcwIcon className="size-4" />
          </MessageAction>
        </MessageActions>
        <MessageBranch defaultBranch={0}>
          <MessageBranchSelector>
            <MessageBranchPrevious />
            <MessageBranchPage />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </MessageToolbar>
    </Message>
  ),

  'mic-selector': () => (
    <MicSelector {...open}>
      <MicSelectorTrigger>
        <MicSelectorValue />
      </MicSelectorTrigger>
      <MicSelectorContent>
        {/* `MicSelectorList` takes a render prop rather than children: it
            enumerates real `MediaDeviceInfo`s. A headless browser grants no
            device permission, so the fixture renders the shape the component
            would produce for one device and the audit says so. */}
        <MicSelectorList>
          {() => <MicSelectorItem value="default">Default microphone</MicSelectorItem>}
        </MicSelectorList>
      </MicSelectorContent>
    </MicSelector>
  ),

  'model-selector': () => (
    <ModelSelector {...open}>
      <ModelSelectorTrigger>Claude Opus</ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorList>
          <ModelSelectorItem value="opus">
            <ModelSelectorName>Claude Opus</ModelSelectorName>
          </ModelSelectorItem>
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  ),

  /* Like `Controls`, `Node` renders React Flow `Handle`s and so needs the
   * canvas store. It is registered as a node type, which is how a consumer uses
   * it. */
  node: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas
        edges={[]}
        nodeTypes={{ custom: CustomNode }}
        nodes={[{ data: {}, id: 'a', position: { x: 0, y: 0 }, type: 'custom' }]}
      />
    </div>
  ),

  'open-in-chat': () => (
    <OpenIn query="What changed in 1.9.0?" {...open}>
      <OpenInTrigger />
      <OpenInContent>
        <OpenInLabel>Open in</OpenInLabel>
        <OpenInChatGPT />
        <OpenInClaude />
      </OpenInContent>
    </OpenIn>
  ),

  'package-info': () => (
    <PackageInfo name="@elirobinson/ai-elements">
      <PackageInfoHeader>
        <PackageInfoName />
        <PackageInfoVersion />
      </PackageInfoHeader>
      <PackageInfoContent>
        <PackageInfoDescription>Vendored AI Elements.</PackageInfoDescription>
      </PackageInfoContent>
    </PackageInfo>
  ),

  panel: () => <Panel>Panel body</Panel>,

  persona: () => <Persona state="idle" />,

  /* PlanTitle is a sibling of PlanTrigger, not its child: PlanTrigger spreads
     its props into a <Button> that already has JSX children, and JSX children
     win — so a title nested inside it is silently dropped and neither the
     sweep nor the demo ever renders one. */
  plan: () => (
    <Plan {...open}>
      <PlanHeader>
        <PlanTitle>Ship the audit</PlanTitle>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>
        <PlanDescription>Measure, classify, patch, record.</PlanDescription>
      </PlanContent>
    </Plan>
  ),

  'prompt-input': () => (
    <PromptInput onSubmit={() => {}}>
      <PromptInputBody>
        <PromptInputTextarea placeholder="Ask something" />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton>
            <PlusIcon className="size-4" />
          </PromptInputButton>
          <PromptInputButton>
            <GlobeIcon className="size-4" />
            Search
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
  ),

  queue: () => (
    <Queue>
      <QueueSection defaultOpen>
        <QueueSectionTrigger>
          <QueueSectionLabel count={1} label="Queued" />
        </QueueSectionTrigger>
        <QueueSectionContent>
          <QueueList>
            <QueueItem>
              <QueueItemIndicator />
              <QueueItemContent>Run the migration</QueueItemContent>
              <QueueItemActions>
                <QueueItemAction>
                  <RefreshCcwIcon className="size-4" />
                </QueueItemAction>
              </QueueItemActions>
            </QueueItem>
          </QueueList>
        </QueueSectionContent>
      </QueueSection>
    </Queue>
  ),

  reasoning: () => (
    <Reasoning {...open} isStreaming={false}>
      <ReasoningTrigger />
      <ReasoningContent>Checked the contract, then measured the control.</ReasoningContent>
    </Reasoning>
  ),

  sandbox: () => (
    <Sandbox>
      <SandboxTabs defaultValue="app">
        <SandboxTabsList>
          <SandboxTabsTrigger value="app">App</SandboxTabsTrigger>
          <SandboxTabsTrigger value="logs">Logs</SandboxTabsTrigger>
        </SandboxTabsList>
        <SandboxContent>
          <SandboxTabContent value="app">Running</SandboxTabContent>
        </SandboxContent>
      </SandboxTabs>
    </Sandbox>
  ),

  'schema-display': () => (
    <SchemaDisplay method="GET" path="/v1/tokens">
      <SchemaDisplayHeader />
      <SchemaDisplayContent>
        <SchemaDisplayBody>
          <SchemaDisplayDescription>Returns the token set.</SchemaDisplayDescription>
        </SchemaDisplayBody>
      </SchemaDisplayContent>
    </SchemaDisplay>
  ),

  shimmer: () => <Shimmer>Thinking</Shimmer>,

  snippet: () => (
    <Snippet code="pnpm add @elirobinson/ai-elements">
      <SnippetInput />
      <SnippetCopyButton />
    </Snippet>
  ),

  sources: () => (
    <Sources {...open}>
      <SourcesTrigger count={2} />
      <SourcesContent>
        <Source href="https://example.com/a" title="Target Size (Minimum)" />
        <Source href="https://example.com/b" title="Target Size (Enhanced)" />
      </SourcesContent>
    </Sources>
  ),

  'speech-input': () => <SpeechInput />,

  'stack-trace': () => (
    <StackTrace
      {...open}
      trace={
        'TypeError: cannot read property\n    at measure (playwright.mjs:275:5)\n    at check (playwright.mjs:411:9)'
      }
    >
      <StackTraceHeader>
        <StackTraceActions>
          <StackTraceCopyButton />
        </StackTraceActions>
      </StackTraceHeader>
      <StackTraceContent />
    </StackTrace>
  ),

  suggestion: () => (
    <Suggestions>
      <Suggestion suggestion="Summarise this thread" />
      <Suggestion suggestion="Show the diff" />
      <Suggestion suggestion="Explain the failure" />
    </Suggestions>
  ),

  task: () => (
    <Task {...open}>
      <TaskTrigger title="Searched the codebase" />
      <TaskContent>
        <TaskItem>Read packages/tokens/src/tokens.css</TaskItem>
      </TaskContent>
    </Task>
  ),

  /* No `<TerminalContent />`, and this is a finding rather than an omission:
   * that subcomponent renders `<Ansi>` from `ansi-to-react`, a CJS-only package
   * whose default export does not survive this bundler's interop — mounting it
   * throws React error #130 ("element type is invalid") before anything can be
   * measured. Recorded in the audit as an upstream/bundler defect for the
   * package owner; it is not an accessibility finding, and it costs this sweep
   * only the terminal's scrollback text. Every control Terminal has is in its
   * header, and the header is mounted here. */
  terminal: () => (
    <Terminal output={'$ pnpm build\nBuilt in 858ms'}>
      <TerminalHeader>
        <TerminalTitle>zsh</TerminalTitle>
        <TerminalActions>
          <TerminalCopyButton />
        </TerminalActions>
      </TerminalHeader>
    </Terminal>
  ),

  'test-results': () => (
    <TestResults>
      <TestResultsHeader />
      <TestResultsContent>
        <TestSuite name="contracts" status="passed">
          <TestSuiteContent>
            <Test name="measures the hit area" status="passed" />
            <Test name="reports a blind probe" status="failed" />
          </TestSuiteContent>
        </TestSuite>
      </TestResultsContent>
    </TestResults>
  ),

  tool: () => (
    <Tool {...open}>
      <ToolHeader state="output-available" type="tool-read_file" />
      <ToolContent>
        <ToolInput input={{ path: 'packages/tokens/src/tokens.css' }} />
        <ToolOutput errorText={undefined} output="44px" />
      </ToolContent>
    </Tool>
  ),

  /* `Toolbar` is React Flow's `NodeToolbar`: it positions itself against the
   * node it belongs to and renders nothing outside one. `isVisible` forces it
   * open, which is the state a user sees it in and the only one worth
   * measuring. */
  toolbar: () => (
    <div style={{ height: 320, width: 640 }}>
      <Canvas
        edges={[]}
        nodeTypes={{ custom: ToolbarNode }}
        nodes={[{ data: {}, id: 'a', position: { x: 0, y: 0 }, type: 'custom' }]}
      />
    </div>
  ),

  transcription: () => (
    <Transcription
      segments={[
        { endSecond: 2, startSecond: 0, text: 'The floor is twenty four.' },
        { endSecond: 5, startSecond: 2, text: 'And it is a floor.' },
      ]}
    >
      {(segment, index) => <TranscriptionSegment index={index} key={index} segment={segment} />}
    </Transcription>
  ),

  'voice-selector': () => (
    <VoiceSelector {...open}>
      <VoiceSelectorTrigger>Aria</VoiceSelectorTrigger>
      <VoiceSelectorContent>
        <VoiceSelectorList>
          <VoiceSelectorItem value="aria">
            <VoiceSelectorName>Aria</VoiceSelectorName>
          </VoiceSelectorItem>
        </VoiceSelectorList>
      </VoiceSelectorContent>
    </VoiceSelector>
  ),

  'web-preview': () => (
    <WebPreview defaultUrl="https://example.com">
      <WebPreviewNavigation>
        <WebPreviewNavigationButton tooltip="Reload">
          <RefreshCcwIcon className="size-4" />
        </WebPreviewNavigationButton>
        <WebPreviewUrl />
        <WebPreviewNavigationButton tooltip="Record">
          <MicIcon className="size-4" />
        </WebPreviewNavigationButton>
      </WebPreviewNavigation>
    </WebPreview>
  ),
};

export { variants } from './variants.js';
