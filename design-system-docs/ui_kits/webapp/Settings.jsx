/* global window, column, cluster, grid, Icon, ICONS, React, KIT_CONTENT -- a browser script:
   it reads the real components from window.DesignSystem (ds-bundle.js), its strings from
   _shared/content.js and its helpers from _shared/Kit.jsx, and publishes onto window for
   the inline script in index.html. */
/* eslint-disable react/jsx-no-undef --
   Icon is defined by _shared/Kit.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope, so there is nothing to import. The directive is here
   because ds-resync writes this file into a consuming repo's .claude/skills/, a directory
   most projects lint. Scoped to the one rule so everything else is still linted. #119 */
/*
 * The settings screen: profile, security and billing tabs. Every control is an
 * @elirobinson/react component.
 */

const {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  FieldError,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  Separator,
  Switch,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} = window.DesignSystem;
const webapp = KIT_CONTENT.webapp;
const muted = { color: 'var(--fg-2)', margin: 0 };

/* -- Settings ------------------------------------------------------------ */

function ProfileTab() {
  const copy = webapp.settings;
  const p = copy.profile;
  return (
    <div style={{ ...column(6), paddingTop: 'var(--space-6)' }}>
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
            <div role="group" aria-labelledby="channels-label" aria-describedby="channels-error" style={column(1)}>
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
      <div style={cluster(3)}>
        <Button variant="primary">{copy.save}</Button>
        <Button variant="secondary">{copy.cancel}</Button>
      </div>
      <Separator />
      <div style={{ ...cluster(4), justifyContent: 'space-between' }}>
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
    <div style={{ ...column(6), paddingTop: 'var(--space-6)' }}>
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={column(4)}>
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
            icon={<Icon d={ICONS.calendar} />}
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
    <div style={{ ...column(6), maxWidth: 1040 }}>
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
      <div style={column(1)}>
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

Object.assign(window, { SettingsScreen });
