'use client';

/* The workflow canvas, mounted.

   Every other example on the AI pages is read off disk and shown as source —
   see lib/examples.ts. This one is also rendered, and that is the point rather
   than an inconsistency: `ai-canvas.css` refuses to be installed unless the app
   ships the keyboard path, and a file no route mounts is not shipped. Rendering
   it is what makes the arrow-key nudging and the connect/disconnect menu real,
   reachable and testable rather than a claim in a comment.

   The example module is imported here rather than copied, so what a reader sees
   below the frame is the code that drew the frame. */

import { WorkflowCanvas } from '../../examples/ai-elements/workflow-canvas';

export function WorkflowCanvasDemo() {
  return (
    <figure className="demo-block">
      <div className="demo-block__stage demo-block__stage--canvas">
        <WorkflowCanvas />
      </div>
      <figcaption className="demo-block__caption">
        Tab to a step, Enter to select, arrow keys to move. Tab again for a port, then its connect
        and disconnect actions.
      </figcaption>
    </figure>
  );
}
