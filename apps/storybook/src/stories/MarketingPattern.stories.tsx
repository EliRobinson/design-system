import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@design-system/react/components/Badge';
import { Button } from '@design-system/react/components/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@design-system/react/components/Card';
import { Eyebrow } from '@design-system/react/components/Eyebrow';
import { RuleLink } from '@design-system/react/components/RuleLink';

const meta = {
  title: 'Patterns/Marketing',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Header, Footer, Hero, Sidebar, and TopBar are app-specific layout compositions — not packaged primitives. Compose them from @elirobinson/react primitives (Button, Badge, Eyebrow, RuleLink, Card) and your own routing. See ui_kits/marketing/ for full-page prototypes.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeroSection: Story = {
  render: () => (
    <section
      style={{
        padding: 'var(--space-12) var(--gutter)',
        borderBottom: '1px solid var(--border)',
        maxWidth: 'var(--container-xl)',
        margin: '0 auto',
      }}
    >
      <Eyebrow>Miltinson Technologies</Eyebrow>
      <h1
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 'var(--fw-semibold)',
          fontSize: 'var(--fs-5xl)',
          letterSpacing: 'var(--tr-tight)',
          margin: 'var(--space-5) 0 0',
          maxWidth: 720,
        }}
      >
        Builder. Consultant. Founder.
      </h1>
      <p
        style={{
          color: 'var(--fg-2)',
          fontSize: 'var(--fs-lg)',
          lineHeight: 'var(--lh-normal)',
          margin: 'var(--space-6) 0 0',
          maxWidth: 560,
        }}
      >
        I'm Eli Robinson — I build software, teach AI, and create resources for coaches.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-8)' }}>
        <Button variant="primary" size="lg">
          View My Work
        </Button>
        <Button variant="secondary" size="lg">
          Work With Me
        </Button>
      </div>
    </section>
  ),
};

export const FeaturedCard: Story = {
  render: () => (
    <div style={{ padding: 'var(--space-8)', maxWidth: 360 }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Badge variant="signal">Education</Badge>
            <Badge variant="anchor">Math</Badge>
          </div>
          <CardTitle>Interactive Maths</CardTitle>
          <CardDescription>Resources for learners of all ages.</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleLink href="#">View app</RuleLink>
        </CardContent>
      </Card>
    </div>
  ),
};
