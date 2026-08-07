import { componentRecord, recordSlugs } from '../../../lib/ai-corpus';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return recordSlugs().map((slug) => ({ component: `${slug}.json` }));
}

export async function GET(_request: Request, context: { params: Promise<{ component: string }> }) {
  const { component } = await context.params;
  const record = componentRecord(component.replace(/\.json$/, ''));
  if (!record) {
    return new Response('Unknown component', { status: 404 });
  }
  return Response.json(record);
}
