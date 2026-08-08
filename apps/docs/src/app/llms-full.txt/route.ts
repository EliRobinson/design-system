import { llmsFull } from '../../lib/ai-corpus';

export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsFull(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
