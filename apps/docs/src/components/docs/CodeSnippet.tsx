import { highlight } from '../../lib/highlight';
import { CopyButton } from '../CopyButton';

export async function CodeSnippet({ code, lang }: { code: string; lang: string }) {
  const html = await highlight(code, lang);
  return (
    <div className="code-block">
      <CopyButton text={code} />
      { }
      <div className="code-block__body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
