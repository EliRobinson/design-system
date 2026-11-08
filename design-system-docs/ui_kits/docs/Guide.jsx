/* eslint-disable react/jsx-no-undef --
   Wordmark is defined by _shared/Kit.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope — so there is nothing to import and no module boundary
   to import it across. The directive is here because ds-resync writes this file into a
   consuming repo's .claude/skills/, a directory most projects lint. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window, React, KIT_CONTENT -- a browser script: it reads the real components
   from window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the inline script in index.html. */
/*
 * A long-form guide page: a sticky table of contents beside a reading column held to
 * --container-md. The callout, tabs, questions and pager are @elirobinson/react
 * components; the prose is plain elements on the type classes.
 */

const {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Checkbox,
  Eyebrow,
  NavigationMenu,
  Pagination,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} = window.DesignSystem;
const guide = KIT_CONTENT.docs;
const article = guide.article;

const column = (gap) => ({ display: 'flex', flexDirection: 'column', gap: `var(--space-${gap})` });
const cluster = (gap) => ({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: `var(--space-${gap})` });
const prose = { margin: 0, color: 'var(--fg)' };

function GuideHeader() {
  return (
    <header style={{ ...cluster(6), justifyContent: 'space-between', padding: 'var(--space-4) var(--space-7)', borderBottom: '1px solid var(--border)' }}>
      <a href="#" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
        <Wordmark />
      </a>
      <Breadcrumb aria-label={guide.breadcrumb.label}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">{guide.breadcrumb.parent}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink current>{guide.breadcrumb.current}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

function Contents({ current }) {
  return (
    <nav style={{ position: 'sticky', top: 'var(--space-6)', ...column(2) }} aria-labelledby="toc-heading">
      <span id="toc-heading" className="t-eyebrow" style={{ color: 'var(--fg-3)', padding: '0 var(--space-3)' }}>
        {guide.tocHeading}
      </span>
      <NavigationMenu aria-label={guide.tocHeading} items={guide.toc.map((item) => ({ label: item.label, href: `#${item.id}` }))} currentPath={current} />
    </nav>
  );
}

function SamplePlan() {
  const sample = article.sample;
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    window.navigator.clipboard?.writeText(sample.code).catch(() => {});
    setCopied(true);
  };
  const label = copied ? sample.copied : sample.copy;
  return (
    <Tabs defaultValue={sample.tabs[0].value}>
      <TabsList aria-label={sample.tabsLabel}>
        {sample.tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="plan">
        <div style={{ position: 'relative', marginTop: 'var(--space-4)' }}>
          <pre className="t-code" style={{ margin: 0, padding: 'var(--space-4)', paddingRight: 'var(--space-12)', overflowX: 'auto', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {sample.code}
          </pre>
          <div style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}>
            <Tooltip labelOnly side="left">
              <TooltipTrigger>
                <Button variant="ghost" size="sm" aria-label={label} onClick={copy}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 9h10v11H9zM5 15H4V4h11v1" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="checklist">
        <div style={{ ...column(1), marginTop: 'var(--space-4)' }}>
          {sample.checklist.map((item) => (
            <Checkbox key={item} label={item} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Article() {
  const [page, setPage] = React.useState(article.page);
  return (
    <article style={{ ...column(7), maxWidth: 'var(--container-md)', minWidth: 0 }}>
      <div style={column(4)}>
        <Eyebrow>{article.eyebrow}</Eyebrow>
        <h1 className="t-display-2" style={prose}>
          {article.title}
        </h1>
        <p className="t-lead" style={{ ...prose, color: 'var(--fg-2)' }}>
          {article.standfirst}
        </p>
        <div style={{ ...cluster(3), justifyContent: 'space-between' }}>
          <div style={cluster(3)}>
            <Avatar alt={article.author.name} fallback={article.author.initials} size="sm" />
            <span className="t-caption" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              {article.author.name} · {article.readingTime} · {article.updated}
            </span>
          </div>
          <div style={cluster(2)}>
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Separator />
      </div>

      {article.sections.map((part) => (
        <section key={part.id} id={part.id} style={column(4)}>
          <h2 className="t-h2" style={prose}>
            {part.heading}
          </h2>
          {part.body.map((paragraph) => (
            <p key={paragraph} className="t-body" style={prose}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <Alert variant="info" title={article.quote.title}>
        {article.quote.body}
      </Alert>

      <section id={article.blocks.id} style={column(4)}>
        <h2 className="t-h2" style={prose}>
          {article.blocks.heading}
        </h2>
        <ol className="t-body" style={{ ...prose, ...column(2), paddingLeft: 'var(--space-6)' }}>
          {article.blocks.items.map((block) => (
            <li key={block.term}>
              <strong>{block.term}</strong>{' '}
              <span className="t-mono" style={{ color: 'var(--fg-2)' }}>
                {block.time}
              </span>{' '}
              — {block.text}
            </li>
          ))}
        </ol>
      </section>

      <section id={article.sample.id} style={column(4)}>
        <h2 className="t-h2" style={prose}>
          {article.sample.heading}
        </h2>
        <SamplePlan />
      </section>

      <section id={article.faq.id} style={column(4)}>
        <h2 className="t-h2" style={prose}>
          {article.faq.heading}
        </h2>
        <Accordion type="multiple" headingLevel={3}>
          {article.faq.items.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Separator />
      <div style={{ ...cluster(4), justifyContent: 'space-between' }}>
        <div style={cluster(2)}>
          <span className="t-body-sm" style={{ color: 'var(--fg-2)' }}>
            {article.helpful.label}
          </span>
          <Button variant="secondary" size="sm">
            {article.helpful.yes}
          </Button>
          <Button variant="secondary" size="sm">
            {article.helpful.no}
          </Button>
        </div>
        <Pagination aria-label={article.pagerLabel} page={page} pageCount={article.pageCount} onPageChange={setPage} />
      </div>
    </article>
  );
}

/* The table of contents marks the section named in the hash. */
function useSectionHash() {
  const read = () => window.location.hash || `#${guide.toc[0].id}`;
  const [hash, setHash] = React.useState(read);
  React.useEffect(() => {
    const onChange = () => setHash(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function GuidePage() {
  const current = useSectionHash();
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh' }}>
      <GuideHeader />
      <div
        style={{
          maxWidth: 'var(--container-xl)',
          margin: '0 auto',
          padding: 'var(--space-9) var(--space-7)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 240px) minmax(0, 1fr)',
          gap: 'var(--space-9)',
          alignItems: 'start',
        }}
      >
        <Contents current={current} />
        <Article />
      </div>
    </div>
  );
}

Object.assign(window, { GuidePage });
