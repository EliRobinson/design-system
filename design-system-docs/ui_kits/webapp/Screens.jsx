/* eslint-disable react/jsx-no-undef --
   PageHeader is defined by ./Shell.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope — so there is nothing to import and no module boundary
   to import it across. The directive is here because ds-resync writes this file into a
   consuming repo's .claude/skills/, a directory most projects lint. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window, React, KIT_CONTENT -- a browser script: it reads the real components
   from window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the inline script in index.html. */
/*
 * The six screens of the web app. Each one is composed only of @elirobinson/react
 * components and layout: the dashboard, the projects grid with the command palette, the
 * invoices table, the assistant, the settings form, and onboarding.
 */

const {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ChatMessage,
  ChatThread,
  Checkbox,
  Chip,
  DecisionCard,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Eyebrow,
  FieldError,
  Input,
  Kbd,
  NavigationMenu,
  Progress,
  RadioGroup,
  RadioGroupItem,
  RuleLink,
  SearchField,
  SegmentedControl,
  Select,
  Separator,
  Skeleton,
  Slider,
  Spinner,
  Stepper,
  StreamingCaret,
  Switch,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  ToastDescription,
  ToastTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} = window.DesignSystem;
const webapp = KIT_CONTENT.webapp;

/* Layout helpers. Spacing comes from the tokens, never a number. */
const stack = (gap) => ({ display: 'flex', flexDirection: 'column', gap: `var(--space-${gap})` });
const row = (gap) => ({ display: 'flex', alignItems: 'center', gap: `var(--space-${gap})`, flexWrap: 'wrap' });
const grid = (min, gap = 4) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  gap: `var(--space-${gap})`,
});
const muted = { color: 'var(--fg-2)', margin: 0 };
/* Figures are mono with tabular digits, at the heading's size. */
const figure = { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', margin: 0 };

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const iconPaths = {
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  calendar: 'M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
};

/* -- Dashboard ------------------------------------------------------------ */

function DashboardScreen({ onSearch }) {
  const copy = webapp.dashboard;
  const [range, setRange] = React.useState(copy.ranges[1].value);
  const [toastOpen, setToastOpen] = React.useState(true);
  return (
    <>
      <PageHeader eyebrow={<Eyebrow>{copy.eyebrow}</Eyebrow>} heading={copy.heading}>
        <Button variant="ghost" size="sm" onClick={onSearch}>
          {webapp.search.label}
          {webapp.search.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Button>
        <SegmentedControl aria-label={copy.rangeLabel} options={copy.ranges} value={range} onValueChange={setRange} />
      </PageHeader>
      <Alert variant="warning" title={copy.alert.title}>
        {copy.alert.body}
      </Alert>
      <div style={grid(200)}>
        {copy.stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <div style={stack(2)}>
                <Eyebrow>{stat.label}</Eyebrow>
                <span className="t-h2" style={figure}>
                  {stat.value}
                </span>
                <div>
                  <Badge variant={stat.variant}>{stat.delta}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader>
            <CardTitle>{copy.projects.title}</CardTitle>
            <CardDescription>{copy.projects.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={stack(4)}>
              {copy.projects.items.map((item) => (
                <div key={item.label} style={stack(2)}>
                  <div className="t-body-sm" style={{ ...row(2), justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    <span style={{ ...figure, color: 'var(--fg-2)' }}>{item.value}%</span>
                  </div>
                  <Progress value={item.value} label={`${item.label}, ${item.value}%`} />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <RuleLink href="#/projects">{copy.projects.link}</RuleLink>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.activity.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul style={{ ...stack(3), listStyle: 'none', margin: 0, padding: 0 }}>
              {copy.activity.items.map((item) => (
                <li key={item.who + item.when} style={row(3)}>
                  <Avatar alt={item.who} fallback={item.initials} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-body-sm">
                      <strong>{item.who}</strong> {item.what}
                    </div>
                    <div className="t-caption" style={{ color: 'var(--fg-3)' }}>
                      {item.when}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{copy.setup.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Stepper aria-label={copy.setup.label} steps={copy.setup.steps.map((label) => ({ label }))} activeStep={copy.setup.active} />
        </CardContent>
        <CardFooter>
          <Button variant="accent" onClick={() => window.go('#/onboarding')}>
            {copy.setup.cta}
          </Button>
        </CardFooter>
      </Card>
      {toastOpen && (
        <div style={{ position: 'fixed', right: 'var(--space-7)', bottom: 'var(--space-7)', width: 'min(360px, calc(100vw - 2 * var(--space-7)))', zIndex: 10 }}>
          <Toast variant="success" onDismiss={() => setToastOpen(false)}>
            <ToastTitle>{copy.toast.title}</ToastTitle>
            <ToastDescription>{copy.toast.body}</ToastDescription>
          </Toast>
        </div>
      )}
    </>
  );
}

/* -- Projects, with the command palette open over them --------------------- */

function ProjectsScreen({ onSearch }) {
  const copy = webapp.projects;
  return (
    <>
      <PageHeader eyebrow={<Eyebrow>{copy.eyebrow}</Eyebrow>} heading={copy.heading}>
        <Button variant="secondary" onClick={onSearch}>
          {copy.open}
          {webapp.search.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Button>
      </PageHeader>
      <div style={grid(260)}>
        {copy.items.map((project) => (
          <Card key={project.name}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.desc}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Badge variant={project.variant}>{project.state}</Badge>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}

/* -- Invoices: a filtered, sorted, paginated table -------------------------- */

const statusBadge = { Paid: 'anchor', Due: 'default', Overdue: 'signal', Draft: 'outline' };

function invoiceRows(copy) {
  return Array.from({ length: 23 }, (_, i) => {
    const pence = (120 + ((i * 53) % 940)) * 100;
    return {
      id: copy.idPrefix + String(1063 - i).padStart(4, '0'),
      client: copy.clients[i % copy.clients.length],
      issued: `${Math.max(28 - i, 1)} ${copy.month}`,
      pence,
      amount: `${copy.currency}${(pence / 100).toFixed(2)}`,
      status: copy.states[i % copy.states.length],
    };
  });
}

function InvoicesScreen() {
  const copy = webapp.invoices;
  const rows = React.useMemo(() => invoiceRows(copy), [copy]);
  const [visible, setVisible] = React.useState(() => Object.fromEntries(copy.optional.map((key) => [key, true])));
  const [sort, setSort] = React.useState(copy.sorts[0].value);
  const [status, setStatus] = React.useState(copy.statuses[0].value);
  const [query, setQuery] = React.useState(copy.searchDefault);
  const [filters, setFilters] = React.useState(copy.filters);

  const shown = rows
    .filter((invoice) => status === 'all' || invoice.status === status)
    .filter((invoice) => `${invoice.id} ${invoice.client}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (sort === 'amount' ? b.pence - a.pence : 0));

  const columns = [
    { accessorKey: 'id', header: copy.columns.id },
    ...copy.optional.filter((key) => visible[key]).map((key) => ({ accessorKey: key, header: copy.columns[key] })),
    {
      accessorKey: 'status',
      header: copy.columns.status,
      cell: (cell) => <Badge variant={statusBadge[cell.getValue()]}>{cell.getValue()}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader eyebrow={<Eyebrow>{copy.eyebrow}</Eyebrow>} heading={copy.heading}>
        <DropdownMenu>
          <DropdownMenuTrigger className="ds-button ds-button--secondary">{copy.view}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{copy.columnsLabel}</DropdownMenuLabel>
            {copy.optional.map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={visible[key]}
                onCheckedChange={(checked) => setVisible((current) => ({ ...current, [key]: checked }))}
              >
                {copy.columns[key]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{copy.sortLabel}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              {copy.sorts.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{copy.exportCsv}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip labelOnly side="bottom">
          <TooltipTrigger>
            <Button variant="secondary" aria-label={copy.download}>
              <Icon d={iconPaths.download} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copy.download}</TooltipContent>
        </Tooltip>
        <Button variant="primary">{copy.create}</Button>
      </PageHeader>
      <div style={grid(200)}>
        {copy.summary.map((item) => (
          <Card key={item.label}>
            <CardContent>
              <Eyebrow>{item.label}</Eyebrow>
              <p className="t-h3" style={{ ...figure, marginTop: 'var(--space-2)' }}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div style={row(3)}>
        <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <SearchField aria-label={copy.search} placeholder={copy.search} value={query} onValueChange={setQuery} />
        </div>
        <SegmentedControl aria-label={copy.statusLabel} options={copy.statuses} value={status} onValueChange={setStatus} />
      </div>
      {filters.length > 0 && (
        <div style={row(2)}>
          <span className="t-caption" style={{ color: 'var(--fg-3)' }}>
            {copy.filtersLabel}
          </span>
          {filters.map((filter) => (
            <Chip key={filter} onRemove={() => setFilters((current) => current.filter((f) => f !== filter))}>
              {filter}
            </Chip>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
            {copy.clear}
          </Button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <Table data={shown} columns={columns} pageSize={8} emptyMessage={copy.empty} />
      </div>
    </>
  );
}

/* -- Assistant ----------------------------------------------------------- */

function AssistantScreen() {
  const copy = webapp.assistant;
  const [messages, setMessages] = React.useState(copy.messages);
  const [draft, setDraft] = React.useState('');
  const send = (text) => {
    if (!text.trim()) return;
    setMessages((current) => [
      ...current.map((message) => ({ ...message, streaming: false })),
      { from: 'me', at: copy.composer.now, text },
    ]);
    setDraft('');
  };
  const avatar = (who) => <Avatar alt={copy[who].name} fallback={copy[who].initials} size="sm" />;
  const actions = (
    <div style={row(1)}>
      {copy.actions.map((action) => (
        <Button key={action} variant="ghost" size="sm">
          {action}
        </Button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-7)', alignItems: 'flex-start' }}>
      <div style={{ ...stack(3), flex: '0 1 240px' }}>
        <Button variant="secondary" size="sm">
          {copy.newChat}
        </Button>
        <SearchField placeholder={copy.searchChats} aria-label={copy.searchChats} />
        <NavigationMenu aria-label={copy.threadsLabel} items={copy.threads} currentPath="#/assistant" />
      </div>
      <div style={{ ...stack(4), flex: '1 1 480px', minWidth: 0, maxWidth: 'var(--container-md)' }}>
        <div style={{ ...row(3), justifyContent: 'space-between' }}>
          <h1 className="t-h4" style={{ margin: 0 }}>
            {copy.heading}
          </h1>
          <span className="t-caption t-mono" style={{ color: 'var(--fg-3)' }}>
            {copy.model}
          </span>
        </div>
        <ChatThread label={copy.threadLabel} style={{ minHeight: 480 }}>
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              variant={message.from === 'me' ? 'sent' : 'received'}
              avatar={avatar(message.from)}
              name={copy[message.from].name}
              timestamp={message.at}
              actions={message.from === 'ai' && !message.streaming ? actions : undefined}
            >
              {message.decision ? (
                <div style={stack(3)}>
                  <span>{message.text}</span>
                  <DecisionCard {...copy.decision} headingLevel={3} />
                </div>
              ) : (
                <>
                  {message.text}
                  {message.streaming && <StreamingCaret label={copy.streaming} />}
                </>
              )}
            </ChatMessage>
          ))}
        </ChatThread>
        <div role="group" aria-label={copy.suggestionsLabel} style={row(2)}>
          {copy.suggestions.map((suggestion) => (
            <Button key={suggestion} variant="secondary" size="sm" onClick={() => send(suggestion)}>
              {suggestion}
            </Button>
          ))}
        </div>
        <form
          style={{ ...row(3), alignItems: 'flex-end', flexWrap: 'nowrap' }}
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <div style={{ flex: 1 }}>
            <Textarea
              label={copy.composer.label}
              placeholder={copy.composer.placeholder}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            {copy.composer.send}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* -- Settings ------------------------------------------------------------ */

function ProfileTab() {
  const copy = webapp.settings;
  const p = copy.profile;
  return (
    <div style={{ ...stack(6), paddingTop: 'var(--space-6)' }}>
      <Alert variant="danger" title={copy.alert.title}>
        {copy.alert.body}
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>{p.title}</CardTitle>
          <CardDescription>{p.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ ...grid(260), alignItems: 'start' }}>
            <Input label={p.name.label} defaultValue={p.name.value} />
            <Input label={p.email.label} type="email" defaultValue={p.email.value} error={p.email.error} />
            <Select label={p.timezone.label} defaultValue="" error={p.timezone.error}>
              <option value="">{p.timezone.placeholder}</option>
              {p.timezone.options.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
            <Input label={p.website.label} hint={p.website.hint} defaultValue={p.website.value} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Textarea label={p.bio.label} hint={p.bio.hint} defaultValue={p.bio.value} />
          </div>
        </CardContent>
      </Card>
      <div style={grid(300, 6)}>
        <Card>
          <CardHeader>
            <CardTitle>{copy.plan.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup name="plan" defaultValue={copy.plan.value} aria-label={copy.plan.label}>
              {copy.plan.options.map((option) => (
                <RadioGroupItem key={option.value} value={option.value} label={option.label} />
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.notifications.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div role="group" aria-labelledby="channels-label" aria-describedby="channels-error" style={stack(1)}>
              <span id="channels-label" className="t-body-sm" style={{ fontWeight: 'var(--fw-medium)' }}>
                {copy.notifications.channelsLabel}
              </span>
              {copy.notifications.channels.map((channel) => (
                <Checkbox key={channel} label={channel} />
              ))}
              <FieldError id="channels-error">{copy.notifications.channelsError}</FieldError>
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Switch label={copy.notifications.weekly} defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Checkbox label={copy.terms.label} error={copy.terms.error} />
      <div style={row(3)}>
        <Button variant="primary">{copy.save}</Button>
        <Button variant="secondary">{copy.cancel}</Button>
      </div>
      <Separator />
      <div style={{ ...row(4), justifyContent: 'space-between' }}>
        <div>
          <strong className="t-body">{copy.danger.title}</strong>
          <p className="t-body-sm" style={{ ...muted, marginTop: 'var(--space-1)' }}>
            {copy.danger.body}
          </p>
        </div>
        <Button variant="destructive">{copy.danger.action}</Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const copy = webapp.settings.security;
  const [trusted, setTrusted] = React.useState(() => Object.fromEntries(copy.devices.map((d) => [d.name, d.trusted])));
  const columns = [
    { accessorKey: 'name', header: copy.deviceColumn },
    { accessorKey: 'lastSeen', header: copy.lastSeenColumn },
    {
      id: 'trusted',
      header: copy.trustColumn,
      /* The row names the switch, so it draws no label of its own. */
      cell: (cell) => {
        const name = cell.row.original.name;
        return (
          <Switch
            label={`${copy.trust} ${name}`}
            hideLabel
            checked={trusted[name]}
            onChange={(event) => setTrusted((current) => ({ ...current, [name]: event.target.checked }))}
          />
        );
      },
    },
  ];
  return (
    <div style={{ ...stack(6), paddingTop: 'var(--space-6)' }}>
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={stack(4)}>
            <Switch label={copy.twoStep} defaultChecked />
            <Table aria-label={copy.devicesLabel} data={copy.devices} columns={columns} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab() {
  const copy = webapp.settings.billing;
  return (
    <div style={{ paddingTop: 'var(--space-6)' }}>
      <Card>
        <CardContent>
          <EmptyState
            title={copy.empty}
            description={copy.emptyBody}
            icon={<Icon d={iconPaths.calendar} />}
            action={<Button variant="secondary">{copy.cta}</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsScreen() {
  const copy = webapp.settings;
  return (
    <div style={{ ...stack(6), maxWidth: 1040 }}>
      <Breadcrumb aria-label={copy.breadcrumb.label}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#/">{copy.breadcrumb.parent}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink current>{copy.breadcrumb.current}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div style={stack(1)}>
        <h1 className="t-h2" style={{ margin: 0 }}>
          {copy.heading}
        </h1>
        <p className="t-body" style={muted}>
          {copy.standfirst}
        </p>
      </div>
      <Tabs defaultValue={copy.tabs[0].value}>
        <TabsList aria-label={copy.tabsLabel}>
          {copy.tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -- Onboarding: a full-page flow with no sidebar ------------------------- */

function OnboardingScreen() {
  const copy = webapp.onboarding;
  const [size, setSize] = React.useState(16);
  return (
    <div style={{ ...stack(7), width: '100%', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ ...row(3), justifyContent: 'space-between' }}>
        <a href="#/" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
          <Wordmark />
        </a>
        <Button variant="ghost" size="sm" onClick={() => window.go('#/')}>
          {copy.skip}
        </Button>
      </div>
      <Stepper aria-label={copy.progressLabel} steps={copy.steps.map((label) => ({ label }))} activeStep={copy.active} />
      <Card>
        <CardHeader>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={stack(4)}>
            <Input label={copy.name.label} defaultValue={copy.name.value} hint={copy.name.hint} />
            <div style={stack(1)}>
              <span id="use-label" className="t-body-sm" style={{ fontWeight: 'var(--fw-medium)' }}>
                {copy.useLabel}
              </span>
              <RadioGroup name="use" defaultValue={copy.uses[0].value} aria-labelledby="use-label">
                {copy.uses.map((use) => (
                  <RadioGroupItem key={use.value} value={use.value} label={use.label} />
                ))}
              </RadioGroup>
            </div>
            <Slider
              label={`${copy.teamSize}, ${size} ${copy.teamSizeUnit}`}
              min={1}
              max={40}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </div>
        </CardContent>
        <CardFooter>
          <div style={row(3)}>
            <Button variant="secondary">{copy.back}</Button>
            <Button variant="accent">{copy.next}</Button>
          </div>
        </CardFooter>
      </Card>
      <div style={grid(280, 6)}>
        <Card>
          <CardContent>
            <EmptyState
              title={copy.empty.title}
              description={copy.empty.body}
              icon={<Icon d={iconPaths.calendar} />}
              action={
                <Button variant="primary" size="sm">
                  {copy.empty.cta}
                </Button>
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.importing.title}</CardTitle>
            <CardDescription>{copy.importing.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={stack(3)}>
              <div style={row(2)}>
                <Spinner size="sm" label={copy.importing.busy} />
                <span className="t-body-sm">{copy.importing.count}</span>
              </div>
              <Progress value={copy.importing.value} label={`${copy.importing.progress}, ${copy.importing.value}%`} />
              {[1, 2, 3].map((n) => (
                <div key={n} style={row(3)}>
                  <Skeleton style={{ width: 32, height: 32, borderRadius: 'var(--radius-pill)' }} />
                  <Skeleton style={{ flex: 1, height: 12 }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, {
  AssistantScreen,
  DashboardScreen,
  InvoicesScreen,
  OnboardingScreen,
  ProjectsScreen,
  SettingsScreen,
});
