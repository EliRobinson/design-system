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

  marketing: {
    title: 'Marketing UI kit',
    nav: ['Home', 'Portfolio', 'Store', 'Services', 'About'],
    hero: {
      eyebrow: 'Miltinson Technologies',
      headline: 'Builder. Consultant.',
      headlineAccent: 'Founder.',
      standfirst: "I'm Eli Robinson — I build software, teach AI, and create resources for coaches.",
      primaryCta: 'View My Work',
      secondaryCta: 'Work With Me',
    },
    featured: {
      heading: 'Featured Apps',
      viewAll: 'View all',
      apps: [
        {
          title: 'Kids Recipes',
          body: 'Simple, fun recipes designed for kids.',
          tags: ['Food', 'Family'],
          thumb: 'recipes',
        },
        {
          title: 'Maths',
          body: 'Interactive maths resources for learners of all ages.',
          tags: ['Education', 'Math'],
          thumb: 'maths',
        },
      ],
    },
    feature: {
      eyebrow: 'Coaching Guides',
      heading: 'Practical, no-fluff guides written for sports coaches.',
      body: 'Drills, session plans, and coaching frameworks. Read on any device, download the PDF, keep forever.',
      cta: 'Browse Guides',
      cards: ['Session Plans for U10s', 'Practice Drills Vol. 1', 'Game-Day Frameworks'],
      cardLabel: 'GUIDE',
    },
    services: {
      detailsLink: 'See details',
      items: [
        {
          eb: 'AI Consulting',
          price: '150',
          body: "Learn how to use AI tools effectively. I'll show you what's actually useful, what's hype, and how to integrate AI into your workflows.",
        },
        {
          eb: 'Tech Support',
          price: '75',
          body: 'Clear, patient tech help for individuals and small businesses who need a trusted hand. No jargon, no judgment — just practical solutions.',
        },
      ],
    },
  },

  webapp: {
    title: 'Web app UI kit',
    account: { name: 'Eli Robinson', initials: 'ER', plan: 'Pro plan' },
    topBarEyebrow: 'Workspace · Miltinson',
    actions: { secondary: 'Export', primary: 'New project' },
    projects: [
      { name: 'Kids Recipes', status: 'Live', tag: 'Web', mrr: '$0', updated: '2d ago' },
      { name: 'Maths', status: 'Live', tag: 'Web', mrr: '$0', updated: '1w ago' },
      {
        name: 'Coaching Guides Vol. 2',
        status: 'Draft',
        tag: 'Guide',
        mrr: '$840',
        updated: 'today',
      },
      {
        name: 'AI Workflow Audit (client)',
        status: 'In progress',
        tag: 'Service',
        mrr: '$1,200',
        updated: '3h ago',
      },
      {
        name: 'Tech Support · Smith Family',
        status: 'In progress',
        tag: 'Service',
        mrr: '$300',
        updated: 'today',
      },
    ],
  },

  mobile: {
    title: 'Mobile UI kit',
    browse: {
      frameLabel: 'Kids Recipes · Browse',
      eyebrow: 'Kids Recipes',
      heading: "What's for breakfast?",
      standfirst: 'Pick a recipe, get cooking.',
      filters: ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'],
      items: [
        { emoji: '🥞', name: 'Banana Pancakes', tag: 'Breakfast', time: '15 min', diff: 'Easy' },
        { emoji: '🥪', name: 'Rainbow Sandwich', tag: 'Lunch', time: '10 min', diff: 'Easy' },
        { emoji: '🍝', name: 'Spaghetti Faces', tag: 'Dinner', time: '25 min', diff: 'Medium' },
        { emoji: '🍪', name: 'No-Bake Cookies', tag: 'Snack', time: '20 min', diff: 'Easy' },
      ],
    },
    practice: {
      frameLabel: 'Maths · Practice',
      progress: 'Question 4 / 10',
      streak: 'Streak ×3',
      topic: 'Multiplication · Year 4',
      question: '7 × 8 = ?',
      answers: ['54', '56', '63', '49'],
    },
  },

  docs: {
    title: 'Docs / guide UI kit',
    toc: [
      'Introduction',
      'Warm-up drills',
      'Session structure',
      'Game-day frameworks',
      'Common mistakes',
      'Printable templates',
    ],
    tocHeading: 'On this page',
    article: {
      eyebrow: 'Coaching Guide · Vol. 01',
      title: 'Session plans for U10s.',
      standfirst:
        'A practical, no-fluff playbook for first-time coaches. 12 sessions, printable templates, and the frameworks I actually use on the pitch.',
      byline: 'By Eli Robinson',
      readingTime: '14 min read',
      updated: 'Updated 26 Apr 2026',
      sections: [
        {
          heading: 'Why structure matters',
          body: [
            'Most beginner coaches show up with a vague plan, run a few drills they remember from when they played, and hope it lands. It rarely does. Kids get bored, parents get frustrated, and you leave the pitch wondering what worked.',
            "A session plan fixes that. Not a rigid script — a scaffold you can adapt on the fly when six players cancel or it's pouring rain.",
          ],
        },
      ],
      quote:
        '"Plan the shape, not the steps. Kids will surprise you — your scaffold should let them."',
      blocksHeading: 'The 4-block session',
      blocks: [
        { term: 'Warm-up', text: '(10 min) — movement + ball touches, no queuing.' },
        { term: 'Skill block', text: '(15 min) — one technique, three reps, low pressure.' },
        {
          term: 'Game block',
          text: '(20 min) — small-sided, modified rules to surface the skill.',
        },
        {
          term: 'Wind-down',
          text: '(5 min) — circle up, ask one question, send them home smiling.',
        },
      ],
      sample: `# Session 03 — Passing under pressure
Warm-up   10 min   triangle passing, 1-touch
Skill     15 min   wall pass, both feet
Game      20 min   3v3 + 2 floaters, no offside
Wind-down  5 min   "what surprised you today?"`,
    },
  },
};

Object.assign(window, { KIT_CONTENT });
