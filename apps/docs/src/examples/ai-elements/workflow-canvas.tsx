'use client';

/**
 * A workflow canvas, and the keyboard path `ai-canvas.css` refuses to be
 * installed without.
 *
 * The stylesheet's own header states the bargain: a node graph's primary
 * interaction is dragging — moving a node, pulling an edge from one port to
 * another — and SC 2.5.7 wants a single-pointer alternative for both while
 * SC 2.1.1 wants the whole thing operable from a keyboard. A 12px port clears
 * SC 2.5.8 only through that standard's equivalent-alternative exemption. Take
 * the alternative away and the port is an accessibility failure, not a small
 * one. So this file ships the two things the CSS assumes, and the two are the
 * reason the ports may stay at 12px:
 *
 *  1. ARROW-KEY NUDGING. `nodesFocusable` puts every node in the tab order and
 *     `nodesDraggable` keeps xyflow's own arrow-key handler live: Tab to a
 *     node, Enter or Space to select it, then the arrow keys move it — and
 *     xyflow announces each move in its own live region, which is why
 *     `disableKeyboardA11y` is left at its default of false rather than being
 *     passed here to say so. Both props are spread onto `ReactFlow` by
 *     `Canvas`, which spreads `{...props}` last.
 *
 *  2. A MENU PATH TO CREATE AND DELETE A CONNECTION. Every port is focusable,
 *     and focusing one opens the node's `Toolbar` with one button per other
 *     node in the graph — "Connect to …" where no edge exists, "Disconnect
 *     from …" where one does. That is create and delete, from the keyboard,
 *     with no drag anywhere in the path. The toolbar is xyflow's own
 *     `NodeToolbar`, so it positions itself and this file contains no
 *     placement arithmetic.
 *
 * The classes are the ones `ai-canvas.css` publishes — `.ds-ai-canvas`,
 * `.ds-ai-node` and its elements, `.ds-ai-canvas-toolbar`,
 * `.ds-ai-canvas-controls`, `.ds-ai-canvas-panel`. Nothing here invents a
 * class name, and nothing here carries a colour: every value is in the layer.
 *
 * Run state renders on three channels, per the accessibility contract — the
 * `data-state` attribute paints the node's inline-start rule and the state
 * label's colour, and `STATE` below supplies the glyph and the word that go
 * beside it in the markup. Colour alone is SC 1.4.1, and "amber" is not a
 * status a screen reader can read out.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Handle,
  Position,
  useEdges,
  useEdgesState,
  useNodes,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';

import { Canvas } from '@elirobinson/ai-elements/components/canvas';
import { Controls } from '@elirobinson/ai-elements/components/controls';
import { Panel } from '@elirobinson/ai-elements/components/panel';
import { Toolbar } from '@elirobinson/ai-elements/components/toolbar';

type RunState = 'idle' | 'running' | 'complete' | 'blocked' | 'error';

/* The three channels, in one place so no caller can render two of them.
   `glyph` is decorative and is hidden from assistive technology; `word` is the
   channel a screen reader actually gets; the colour is the stylesheet's, keyed
   off `data-state`. A state added here without both fields fails to compile. */
const STATE: Record<RunState, { glyph: string; word: string }> = {
  idle: { glyph: '○', word: 'Idle' },
  running: { glyph: '◐', word: 'Running' },
  complete: { glyph: '●', word: 'Complete' },
  blocked: { glyph: '◑', word: 'Blocked' },
  error: { glyph: '✕', word: 'Failed' },
};

type StepData = {
  kind: string;
  title: string;
  meta: string;
  state: RunState;
};

type StepNode = Node<StepData, 'step'>;

/* One step in the graph.

   `handles={{ target: false, source: false }}` is not available here — this is
   not AI Elements' `Node`, which hardcodes its two `Handle`s with no className
   of their own and so cannot carry `.ds-ai-node__port`. The handles are
   rendered directly instead, as children of the positioned `.ds-ai-node`, so
   xyflow measures their bounds exactly as it would upstream. */
/* Every text slot below is a `div` or a `span`, never an `h3` or a `p`, and
   that matches AI Elements' own primitives — `NodeTitle` renders shadcn's
   `CardTitle`, which is a div. It also matters here specifically: this demo is
   mounted inside the docs site's `.prose` article, whose `h3` and `p` rules are
   (0,1,1) and would outrank the theme layer's (0,1,0) class selectors and
   restyle the node from the page's chrome. Elements `.prose` does not claim
   cannot lose that fight, so there is nothing to fix. */
function StepNodeView({ id, data, selected }: NodeProps<StepNode>) {
  const [portFocused, setPortFocused] = useState<'target' | 'source' | null>(null);
  const channel = STATE[data.state];

  return (
    <div className="ds-ai-node" data-selected={selected || undefined} data-state={data.state}>
      {/* The toolbar is the menu path. It is shown while a port has focus, so
          reaching a port from the keyboard reaches the connection actions —
          and it is also shown on selection, which is the pointer path to the
          same buttons. `NodeToolbar` places itself. */}
      <Toolbar
        className="ds-ai-canvas-toolbar"
        isVisible={portFocused !== null || selected}
        // Keep the toolbar reachable: moving focus from the port into a button
        // inside it must not be read as the port losing focus.
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
            setPortFocused(null);
          }
        }}
      >
        <ConnectionActions nodeId={id} />
      </Toolbar>

      <Handle
        aria-label={`Input port of ${data.title}. Focus for connection actions.`}
        className="ds-ai-node__port"
        onBlur={() => setPortFocused((side) => (side === 'target' ? null : side))}
        onFocus={() => setPortFocused('target')}
        position={Position.Left}
        tabIndex={0}
        type="target"
      />

      <div className="ds-ai-node__kind">{data.kind}</div>
      <div className="ds-ai-node__title">{data.title}</div>
      <div className="ds-ai-node__meta">{data.meta}</div>
      <div className="ds-ai-node__state">
        <span aria-hidden="true">{channel.glyph}</span>
        {channel.word}
      </div>

      <Handle
        aria-label={`Output port of ${data.title}. Focus for connection actions.`}
        className="ds-ai-node__port"
        onBlur={() => setPortFocused((side) => (side === 'source' ? null : side))}
        onFocus={() => setPortFocused('source')}
        position={Position.Right}
        tabIndex={0}
        type="source"
      />
    </div>
  );
}

/* The buttons themselves, split out so the node body stays a shape and this
   stays a behaviour. One per other node: create where there is no edge,
   delete where there is. */
function ConnectionActions({ nodeId }: { nodeId: string }) {
  const nodes = useNodes<StepNode>();
  const edges = useEdges();

  return (
    <>
      {nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => {
          const existing = edges.find(
            (edge) =>
              (edge.source === nodeId && edge.target === node.id) ||
              (edge.source === node.id && edge.target === nodeId),
          );
          const title = node.data.title;

          return (
            <button
              className="ds-ai-canvas-toolbar__btn"
              data-variant={existing ? 'danger' : undefined}
              key={node.id}
              onClick={() => {
                const detail = existing
                  ? { type: 'disconnect' as const, edgeId: existing.id }
                  : { type: 'connect' as const, source: nodeId, target: node.id };
                globalThis.dispatchEvent(new CustomEvent('ds-ai-canvas-edge', { detail }));
              }}
              type="button"
            >
              <span aria-hidden="true">{existing ? '⊘' : '⊕'}</span>
              {existing ? `Disconnect from ${title}` : `Connect to ${title}`}
            </button>
          );
        })}
    </>
  );
}

/* The inspector. A child of `Canvas`, so it is inside the flow's store and can
   read the selection without a provider of its own. */
function Inspector() {
  const nodes = useNodes<StepNode>();
  const selected = nodes.find((node) => node.selected);

  return (
    <Panel className="ds-ai-canvas-panel" position="bottom-right">
      <header className="ds-ai-canvas-panel__header">
        <div className="ds-ai-canvas-panel__title">Inspector</div>
      </header>
      <div className="ds-ai-canvas-panel__body">
        {selected ? (
          <>
            <div className="ds-ai-canvas-panel__row">
              <span className="ds-ai-canvas-panel__label">Step</span>
              <span className="ds-ai-canvas-panel__value">{selected.data.title}</span>
            </div>
            <div className="ds-ai-canvas-panel__row">
              <span className="ds-ai-canvas-panel__label">State</span>
              <span className="ds-ai-canvas-panel__value">
                <span aria-hidden="true">{STATE[selected.data.state].glyph} </span>
                {STATE[selected.data.state].word}
              </span>
            </div>
            <div className="ds-ai-canvas-panel__row">
              <span className="ds-ai-canvas-panel__label">Id</span>
              <span className="ds-ai-canvas-panel__value">
                <code>{selected.id}</code>
              </span>
            </div>
          </>
        ) : (
          <div className="ds-ai-canvas-panel__value">
            Tab to a step and press Enter to select it. Arrow keys move it.
          </div>
        )}
      </div>
    </Panel>
  );
}

/* Held as the flow's own `Node`, not as `StepNode[]`. `Canvas` is
   `ReactFlowProps` with no generic of its own, so it takes `OnNodesChange<Node>`
   and an `onNodesChange` narrowed to a node subtype does not fit it. The typed
   view of the data is taken where it is read — `useNodes<StepNode>()` — rather
   than asserted here. */
const INITIAL_NODES: Node[] = [
  {
    id: 'retrieve',
    type: 'step',
    position: { x: 0, y: 0 },
    data: { kind: 'retrieval', title: 'Retrieve', meta: '12 documents', state: 'complete' },
  },
  {
    id: 'draft',
    type: 'step',
    position: { x: 270, y: 0 },
    data: { kind: 'generation', title: 'Draft', meta: 'streaming', state: 'running' },
  },
  {
    id: 'review',
    type: 'step',
    position: { x: 0, y: 250 },
    data: { kind: 'evaluation', title: 'Review', meta: 'waiting on Draft', state: 'blocked' },
  },
];

const INITIAL_EDGES: Edge[] = [{ id: 'retrieve-draft', source: 'retrieve', target: 'draft' }];

/* Declared once, at module scope. xyflow warns and re-mounts every node when
   this object's identity changes between renders. */
const NODE_TYPES = { step: StepNodeView };

const FIT_VIEW = { padding: 0.14 };

export function WorkflowCanvas() {
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  /* The toolbar buttons live inside a node, which xyflow renders outside this
     component's tree. An event carries their intent back rather than a
     callback threaded through `data` — putting a function in node data makes
     every node's data non-serialisable, which is the thing xyflow asks you not
     to do. */
  const applyEdgeIntent = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { type: 'connect'; source: string; target: string }
        | { type: 'disconnect'; edgeId: string };

      setEdges((current) =>
        detail.type === 'disconnect'
          ? current.filter((edge) => edge.id !== detail.edgeId)
          : [
              ...current,
              {
                id: `${detail.source}-${detail.target}`,
                source: detail.source,
                target: detail.target,
              },
            ],
      );
    },
    [setEdges],
  );

  useEffect(() => {
    globalThis.addEventListener('ds-ai-canvas-edge', applyEdgeIntent);
    return () => globalThis.removeEventListener('ds-ai-canvas-edge', applyEdgeIntent);
  }, [applyEdgeIntent]);

  return (
    <Canvas
      className="ds-ai-canvas"
      edges={edges}
      /* `Canvas` turns `fitView` on for us, and its default padding lets the
         graph fill the box edge to edge — which puts the nodes underneath the
         Controls and the Inspector, both of which float over the same surface.
         The padding is what keeps the two apart, and it is a proportion of the
         viewport rather than a pixel inset, so it holds at any stage size. */
      fitViewOptions={FIT_VIEW}
      /* The two props the stylesheet's header names. `nodesFocusable` puts
         nodes in the tab order; `nodesDraggable` is what keeps xyflow's
         arrow-key handler live for a selected node — it gates the keyboard
         move as well as the pointer one. */
      nodeTypes={NODE_TYPES}
      nodes={nodes}
      nodesDraggable
      nodesFocusable
      onEdgesChange={onEdgesChange}
      onNodesChange={onNodesChange}
    >
      <Controls className="ds-ai-canvas-controls" />
      <Inspector />
    </Canvas>
  );
}
