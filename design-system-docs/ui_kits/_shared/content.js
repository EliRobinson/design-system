/* global window -- a browser script, like every other file in these kits: it publishes
   onto window for the kit files loaded after it. See any kit's index.html. */
/*
 * Every string the kits render, in one place.
 *
 * The kit taxonomy is the system's — marketing, webapp, mobile and docs are surface
 * archetypes any product has, and they are worth shipping. The words inside them are one
 * company's. Those words were spread across 13 files, which made two things true at once:
 * a consumer reskinning the kits had 41 edits to find, and a new brand string arriving in
 * a kit was invisible, because there was no single place it was supposed to be.
 *
 * So this file holds Miltinson's values rather than a neutral placeholder's. It is one of
 * the few files `docs/agents/brand-boundary.md` permits to, for the same reason
 * `miltinson.voice.json` is: holding a brand's values is what it is for. Everything
 * around it is structure a consumer keeps.
 *
 * Loaded as a plain <script> before the JSX, so it is available to every kit file as
 * KIT_CONTENT. Not a module: these kits have no build step, and their <script
 * type="text/babel"> tags share one global scope.
 */

const KIT_CONTENT = {
  /* The identity itself. Everything else on this page is copy; these four are the brand. */
  brand: {
    wordmark: 'Miltinson',
    legalName: 'Miltinson Technologies',
    domain: 'miltinsons.com',
    copyright: '© 2026 Miltinson Technologies. All rights reserved.',
  },

  /* The bar at the top of every kit, which sets the theme and the palette. */
  chrome: {
    label: 'Kit settings',
    theme: 'Theme',
    themes: [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
    palette: 'Palette',
    /* The palette with no data-palette attribute. The others are read from the stylesheets. */
    defaultPalette: 'Ember',
  },

  marketing: {
    title: 'Marketing UI kit',
    navLabel: 'Main',
    nav: ['Home', 'Portfolio', 'Store', 'Services', 'About'],
    headerCta: 'Hire me',
    hero: {
      eyebrow: 'Miltinson Technologies',
      headline: 'Builder. Consultant.',
      headlineAccent: 'Founder.',
      standfirst: "I'm Eli Robinson — I build software, teach AI, and create resources for coaches.",
      primaryCta: 'View my work',
      secondaryCta: 'Work with me',
    },
    featured: {
      heading: 'Featured apps',
      viewAll: 'View all',
      open: 'Open app',
      apps: [
        {
          title: 'Kids Recipes',
          body: 'Simple, fun recipes designed for kids.',
          tags: ['Food', 'Family'],
          status: 'Live',
          mark: '🍳',
        },
        {
          title: 'Interactive Maths',
          body: 'Interactive maths resources for learners of all ages.',
          tags: ['Education', 'Maths'],
          status: 'Beta',
          mark: '7 × 8',
        },
      ],
    },
    feature: {
      eyebrow: 'Coaching Guides',
      heading: 'Practical, no-fluff guides written for sports coaches.',
      body: 'Drills, session plans, and coaching frameworks. Read on any device, download the PDF, keep forever.',
      cta: 'Browse guides',
      cardLabel: 'Guide',
      cards: [
        { title: 'Session plans for U10s', meta: '12 sessions · PDF' },
        { title: 'Practice drills, vol. 1', meta: '40 drills · PDF' },
        { title: 'Game-day frameworks', meta: '6 templates · PDF' },
      ],
    },
    services: {
      heading: 'Services',
      detailsLink: 'See details',
      pricePrefix: 'From',
      priceUnit: '/hr',
      items: [
        {
          eb: 'AI Consulting',
          price: '$150',
          body: "Learn how to use AI tools effectively. I'll show you what's actually useful, what's hype, and how to integrate AI into your workflows.",
          points: ['Workflow audit', 'Hands-on training', 'Follow-up notes'],
        },
        {
          eb: 'Tech Support',
          price: '$75',
          body: 'Clear, patient tech help for individuals and small businesses who need a trusted hand. No jargon, no judgment — just practical solutions.',
          points: ['Remote or in person', 'No contracts required', 'Plain-English fixes'],
        },
      ],
    },
    faq: {
      heading: 'Questions',
      items: [
        {
          q: 'Do I need to be technical?',
          a: 'No. Every session starts from what you already use, and ends with notes you can follow on your own.',
        },
        {
          q: 'Is there a contract?',
          a: 'No contracts required. Book one hour, or as many as you need.',
        },
        {
          q: 'How fast do you reply?',
          a: "Tell me what you need and I'll get back to you within 24 hours.",
        },
      ],
    },
    newsletter: {
      heading: 'Get the next guide first',
      body: 'One email when a new guide or app ships. Nothing else.',
      label: 'Email',
      placeholder: 'you@example.com',
      cta: 'Get in touch',
    },
    footer: {
      tagline: 'Builder · Consultant · Founder',
      navLabel: 'Footer',
      nav: ['Portfolio', 'Store', 'Services', 'About'],
    },
  },

  webapp: {
    title: 'Web app UI kit',
    navLabel: 'App',
    /* The kit routes on the hash, so each screen has its own link. */
    nav: [
      { label: 'Dashboard', href: '#/' },
      { label: 'Projects', href: '#/projects' },
      { label: 'Invoices', href: '#/invoices' },
      { label: 'Assistant', href: '#/assistant' },
      { label: 'Settings', href: '#/settings' },
      { label: 'Onboarding', href: '#/onboarding' },
    ],
    account: { name: 'Eli Robinson', initials: 'ER', plan: 'Studio plan' },
    search: { label: 'Search', keys: ['⌘', 'K'] },

    /* The command palette, open on Projects and on ⌘K everywhere. */
    commands: [
      { id: 'new-invoice', label: 'New invoice', group: 'Actions', shortcut: ['⌘', 'I'] },
      { id: 'new-project', label: 'New project', group: 'Actions', shortcut: ['⌘', 'N'] },
      { id: 'invite', label: 'Invite a teammate', group: 'Actions' },
      { id: 'p-kids', label: 'Kids Recipes', group: 'Projects', detail: 'Live · iOS and web' },
      { id: 'p-maths', label: 'Interactive Maths', group: 'Projects', detail: 'Beta' },
      { id: 'p-guides', label: 'Coaching Guides', group: 'Projects', detail: 'Live · store' },
      { id: 'settings', label: 'Account settings', group: 'Go to', shortcut: ['⌘', ','], href: '#/settings' },
      { id: 'invoices', label: 'Invoices', group: 'Go to', href: '#/invoices' },
      { id: 'assistant', label: 'Assistant', group: 'Go to', href: '#/assistant' },
    ],

    dashboard: {
      eyebrow: 'Saturday 7 November',
      heading: 'Good evening, Eli',
      rangeLabel: 'Range',
      ranges: [
        { label: '7 days', value: '7d' },
        { label: '30 days', value: '30d' },
        { label: '90 days', value: '90d' },
      ],
      alert: {
        title: 'Storage nearly full',
        body: 'Kids Recipes uses 9.2 of 10 GB. Old exports are removed first.',
      },
      stats: [
        { label: 'Revenue', value: '£8,535', delta: '+12% vs last month', variant: 'anchor' },
        { label: 'Active users', value: '3,210', delta: '+4%', variant: 'anchor' },
        { label: 'Open invoices', value: '9', delta: '2 overdue', variant: 'signal' },
        { label: 'Support replies', value: '4h', delta: 'Median', variant: 'default' },
      ],
      projects: {
        title: 'Projects',
        description: 'Progress to the next release.',
        items: [
          { label: 'Kids Recipes 2.0', value: 72 },
          { label: 'Interactive Maths', value: 45 },
          { label: 'Coaching Guides store', value: 90 },
        ],
        link: 'All projects',
      },
      activity: {
        title: 'Recent activity',
        items: [
          { who: 'Mara Okafor', initials: 'MO', what: 'joined the Studio workspace', when: '12 minutes ago' },
          { who: 'Eli Robinson', initials: 'ER', what: 'shipped Kids Recipes 1.9', when: '2 hours ago' },
          { who: 'Sam Patel', initials: 'SP', what: 'bought the Rondo guide', when: 'Yesterday' },
          { who: 'Oak Lane School', initials: 'OL', what: 'paid INV-1063', when: 'Yesterday' },
        ],
      },
      setup: {
        title: 'Finish setting up',
        label: 'Setup progress',
        steps: ['Account', 'Workspace', 'Invite team', 'Connect payments'],
        active: 2,
        cta: 'Continue setup',
      },
      toast: { title: 'Invoice INV-1063 paid', body: 'Oak Lane School paid £420.00.' },
    },

    projects: {
      eyebrow: 'Workspace',
      heading: 'Projects',
      open: 'Search projects and actions',
      items: [
        { name: 'Kids Recipes', desc: 'Cooking app for children.', state: 'Live', variant: 'anchor' },
        { name: 'Interactive Maths', desc: 'Practice that adapts.', state: 'Beta', variant: 'signal' },
        { name: 'Coaching Guides', desc: 'Session plans for coaches.', state: 'Live', variant: 'anchor' },
        { name: 'Studio site', desc: 'miltinsons.com', state: 'Live', variant: 'anchor' },
        { name: 'Invoice tool', desc: 'Internal billing.', state: 'Draft', variant: 'outline' },
        { name: 'Design system', desc: '@elirobinson/react', state: 'v3.9', variant: 'default' },
      ],
    },

    invoices: {
      eyebrow: 'Billing',
      heading: 'Invoices',
      view: 'View',
      columnsLabel: 'Columns',
      sortLabel: 'Sort by',
      sorts: [
        { value: 'newest', label: 'Newest first' },
        { value: 'amount', label: 'Largest amount' },
      ],
      exportCsv: 'Export CSV',
      download: 'Download all as PDF',
      create: 'New invoice',
      summary: [
        { label: 'Outstanding', value: '£3,420' },
        { label: 'Overdue', value: '£860' },
        { label: 'Paid this month', value: '£5,115' },
      ],
      search: 'Search invoices',
      searchDefault: 'school',
      statusLabel: 'Status',
      statuses: [
        { label: 'All', value: 'all' },
        { label: 'Due', value: 'Due' },
        { label: 'Overdue', value: 'Overdue' },
        { label: 'Paid', value: 'Paid' },
      ],
      filtersLabel: 'Filters',
      filters: ['Last 90 days', 'GBP'],
      clear: 'Clear all',
      empty: 'No invoices match these filters.',
      columns: {
        id: 'Invoice',
        client: 'Client',
        issued: 'Issued',
        amount: 'Amount',
        status: 'Status',
      },
      /* Columns the View menu can hide. */
      optional: ['client', 'issued', 'amount'],
      clients: [
        'Oak Lane School',
        'Northside FC',
        'Bramble Bakery',
        'Harbour Physio',
        'Kestrel Coaching',
        'St Anne’s School',
        'Fern & Co',
      ],
      states: ['Paid', 'Due', 'Overdue', 'Paid', 'Draft'],
      month: 'Oct 2026',
      currency: '£',
      idPrefix: 'INV-',
    },

    assistant: {
      threadsLabel: 'Chats',
      newChat: 'New chat',
      searchChats: 'Search chats',
      threads: [
        { label: 'Today', items: [{ label: 'U10 passing session', href: '#/assistant' }, { label: 'Kit order sizes', href: '#/assistant/kit' }] },
        { label: 'Earlier', items: [{ label: 'Invoice wording', href: '#/assistant/invoice' }, { label: 'Netball warm-ups', href: '#/assistant/netball' }] },
      ],
      heading: 'U10 passing session',
      model: 'claude-sonnet-5-5',
      threadLabel: 'Conversation with the coaching assistant',
      me: { name: 'Eli', initials: 'ER' },
      ai: { name: 'Assistant', initials: 'AI' },
      actions: ['Copy', 'Retry'],
      messages: [
        { from: 'me', at: '09:41', text: 'Should I book the Saturday pitch for the U10s? 16 players, budget is £70.' },
        { from: 'ai', at: '09:41', text: 'Yes. It fits the budget with room for bibs. Here is the breakdown.', decision: true },
        { from: 'me', at: '09:43', text: 'Great. Now plan a 45-minute passing session.' },
        {
          from: 'ai',
          at: '09:43',
          text: 'Warm-up, 10 minutes: rondo in fours, two touch. Main block, 25 minutes: box passing with a rotating defender',
          streaming: true,
        },
      ],
      decision: {
        verdict: 'go',
        verdictLabel: 'Go',
        headline: 'Book the Saturday pitch',
        subject: 'Northside FC · U10',
        figures: [
          { label: 'Pitch, 2 hours', value: '£52.00' },
          { label: 'Bibs and cones', value: '£15.20' },
        ],
        total: { label: 'Total', value: '£67.20' },
        caveat: 'Rain cover is not included.',
      },
      streaming: 'Still writing',
      suggestionsLabel: 'Suggested replies',
      suggestions: ['Make it 30 minutes', 'Add a goalkeeper drill', 'Print as a PDF'],
      composer: { label: 'Message', placeholder: 'Ask about drills, plans or kit', send: 'Send', now: 'Now' },
    },

    settings: {
      breadcrumb: { label: 'Breadcrumb', parent: 'Workspace', current: 'Settings' },
      heading: 'Account settings',
      standfirst: 'Your profile, plan and notifications.',
      tabsLabel: 'Settings sections',
      tabs: [
        { value: 'profile', label: 'Profile' },
        { value: 'security', label: 'Security' },
        { value: 'billing', label: 'Billing' },
      ],
      alert: { title: 'Fix 4 fields to save', body: 'Each field below says what to change.' },
      profile: {
        title: 'Profile',
        description: 'Shown on invoices and shared guides.',
        name: { label: 'Full name', value: 'Eli Robinson' },
        email: {
          label: 'Email',
          value: 'eli@miltinsons',
          error: 'Enter an email with a domain, like eli@miltinsons.com.',
        },
        timezone: {
          label: 'Time zone',
          placeholder: 'Choose…',
          options: ['Europe/London', 'America/New_York', 'Australia/Sydney'],
          error: 'Choose a time zone so reminders arrive on time.',
        },
        website: { label: 'Website', hint: 'Optional.', value: 'https://miltinsons.com' },
        bio: {
          label: 'Bio',
          hint: 'Up to 160 characters.',
          value: 'Indie builder, consultant and founder. Practical tech, honestly built.',
        },
      },
      plan: {
        title: 'Plan',
        label: 'Plan',
        options: [
          { value: 'solo', label: 'Solo · free' },
          { value: 'studio', label: 'Studio · £12 / month' },
          { value: 'team', label: 'Team · £40 / month' },
        ],
        value: 'studio',
      },
      notifications: {
        title: 'Notifications',
        channelsLabel: 'Channels',
        channels: ['Email', 'SMS'],
        channelsError: 'Pick at least one channel.',
        weekly: 'Weekly summary',
      },
      terms: { label: 'I agree to the updated terms', error: 'Accept the terms to save.' },
      save: 'Save changes',
      cancel: 'Cancel',
      danger: {
        title: 'Delete account',
        body: 'Removes every project and invoice. You cannot undo this.',
        action: 'Delete account',
      },
      security: {
        title: 'Sign-in',
        description: 'Where your account is signed in.',
        twoStep: 'Ask for a code when I sign in',
        devicesLabel: 'Trusted devices',
        deviceColumn: 'Device',
        lastSeenColumn: 'Last seen',
        trustColumn: 'Trusted',
        trust: 'Trust',
        devices: [
          { name: 'MacBook Pro', lastSeen: 'Now', trusted: true },
          { name: 'iPhone 17', lastSeen: 'Today, 08:12', trusted: true },
          { name: 'Library PC', lastSeen: '3 Oct 2026', trusted: false },
        ],
      },
      billing: {
        empty: 'No invoices yet',
        emptyBody: 'Your first invoice appears here at the end of the month.',
        cta: 'Change plan',
      },
    },

    onboarding: {
      skip: 'Skip for now',
      progressLabel: 'Setup progress',
      steps: ['Account', 'Workspace', 'Invite team', 'Done'],
      /* Stepper counts from 1. */
      active: 2,
      eyebrow: 'Step 2 of 4',
      title: 'Name your workspace',
      description: 'You can change this later in Settings.',
      name: { label: 'Workspace name', value: 'Northside FC', hint: 'Your team sees this name.' },
      useLabel: 'What will you use it for?',
      uses: [
        { value: 'club', label: 'A sports club' },
        { value: 'school', label: 'A school' },
        { value: 'me', label: 'Just me' },
      ],
      teamSize: 'Team size',
      teamSizeUnit: 'players',
      back: 'Back',
      next: 'Continue',
      empty: {
        title: 'No sessions yet',
        body: 'Plan your first session, or ask the assistant to draft one.',
        cta: 'Plan a session',
      },
      importing: {
        title: 'Importing your players',
        description: 'From roster.csv',
        busy: 'Importing',
        count: '10 of 16 players',
        progress: 'Import progress',
        value: 62,
      },
    },
  },

  mobile: {
    title: 'Mobile UI kit',
    tabsLabel: 'App',
    tabs: ['Browse', 'Practice', 'Account'],
    browse: {
      frameLabel: 'Kids Recipes · Browse',
      eyebrow: 'Kids Recipes',
      heading: "What's for breakfast?",
      standfirst: 'Pick a recipe, get cooking.',
      search: 'Search recipes',
      filtersLabel: 'Meal',
      filters: ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'],
      items: [
        { emoji: '🥞', name: 'Banana pancakes', tag: 'Breakfast', time: '15 min', diff: 'Easy' },
        { emoji: '🥪', name: 'Rainbow sandwich', tag: 'Lunch', time: '10 min', diff: 'Easy' },
        { emoji: '🍝', name: 'Spaghetti faces', tag: 'Dinner', time: '25 min', diff: 'Medium' },
        { emoji: '🍪', name: 'No-bake cookies', tag: 'Snack', time: '20 min', diff: 'Easy' },
      ],
      empty: 'No recipes match.',
    },
    practice: {
      frameLabel: 'Interactive Maths · Practice',
      progressLabel: 'Question 4 of 10',
      progress: 40,
      streak: 'Streak ×3',
      topic: 'Multiplication · Year 4',
      question: '7 × 8 = ?',
      answersLabel: 'Your answer',
      answers: ['54', '56', '63', '49'],
      correct: '56',
      check: 'Check',
      right: { title: 'Correct', body: '7 × 8 = 56. On to question 5.' },
      wrong: { title: 'Not quite', body: 'Try counting up in sevens from 7 × 5 = 35.' },
    },
    account: {
      frameLabel: 'Kids Recipes · Account',
      name: 'Sam Patel',
      initials: 'SP',
      plan: 'Family plan',
      settingsLabel: 'Notifications',
      settings: [
        { label: 'New recipes every Friday', on: true },
        { label: 'Shopping list reminders', on: false },
        { label: 'Weekly cooking streak', on: true },
      ],
      signOut: 'Sign out',
    },
  },

  docs: {
    title: 'Docs / guide UI kit',
    breadcrumb: { label: 'Breadcrumb', parent: 'Coaching Guides', current: 'Vol. 01' },
    tocHeading: 'On this page',
    toc: [
      { label: 'Why structure matters', id: 'why' },
      { label: 'The 4-block session', id: 'blocks' },
      { label: 'A sample plan', id: 'sample' },
      { label: 'Common questions', id: 'faq' },
    ],
    article: {
      eyebrow: 'Coaching Guide · Vol. 01',
      title: 'Session plans for U10s.',
      standfirst:
        'A practical, no-fluff playbook for first-time coaches. 12 sessions, printable templates, and the frameworks I actually use on the pitch.',
      author: { name: 'Eli Robinson', initials: 'ER' },
      readingTime: '14 min read',
      updated: 'Updated 26 Apr 2026',
      tags: ['Football', 'Ages 8–10', 'Printable'],
      sections: [
        {
          id: 'why',
          heading: 'Why structure matters',
          body: [
            'Most beginner coaches show up with a vague plan, run a few drills they remember from when they played, and hope it lands. It rarely does. Kids get bored, parents get frustrated, and you leave the pitch wondering what worked.',
            "A session plan fixes that. Not a rigid script — a scaffold you can adapt on the fly when six players cancel or it's pouring rain.",
          ],
        },
      ],
      quote: {
        title: 'Plan the shape, not the steps',
        body: 'Kids will surprise you — your scaffold should let them.',
      },
      blocks: {
        id: 'blocks',
        heading: 'The 4-block session',
        items: [
          { term: 'Warm-up', time: '10 min', text: 'Movement and ball touches, no queuing.' },
          { term: 'Skill block', time: '15 min', text: 'One technique, three reps, low pressure.' },
          { term: 'Game block', time: '20 min', text: 'Small-sided, modified rules to surface the skill.' },
          { term: 'Wind-down', time: '5 min', text: 'Circle up, ask one question, send them home smiling.' },
        ],
      },
      sample: {
        id: 'sample',
        heading: 'A sample plan',
        tabsLabel: 'Sample format',
        tabs: [
          { value: 'plan', label: 'Plan' },
          { value: 'checklist', label: 'Kit checklist' },
        ],
        code: `# Session 03 — Passing under pressure
Warm-up   10 min   triangle passing, 1-touch
Skill     15 min   wall pass, both feet
Game      20 min   3v3 + 2 floaters, no offside
Wind-down  5 min   "what surprised you today?"`,
        copy: 'Copy plan',
        copied: 'Copied',
        checklist: ['12 cones', '16 bibs, two colours', '6 size-4 balls', 'First-aid kit'],
      },
      faq: {
        id: 'faq',
        heading: 'Common questions',
        items: [
          {
            q: 'What if only six players turn up?',
            a: 'Drop the game block to 3v3 and keep the floaters. The skill block works with any even number.',
          },
          {
            q: 'Can I run this indoors?',
            a: 'Yes. Swap the wall pass for a bench rebound, and halve the pitch.',
          },
        ],
      },
      helpful: { label: 'Was this page helpful?', yes: 'Yes', no: 'No' },
      pagerLabel: 'Guide pages',
      page: 2,
      pageCount: 12,
    },
  },
};

Object.assign(window, { KIT_CONTENT });
