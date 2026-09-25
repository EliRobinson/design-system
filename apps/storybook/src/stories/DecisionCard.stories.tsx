import type { Meta, StoryObj } from '@storybook/react-vite';
import { DecisionCard } from '@design-system/react/components/molecules/DecisionCard';
import { Button } from '@design-system/react/components/atoms/Button';

const meta = {
  title: 'Components/DecisionCard',
  component: DecisionCard,
  tags: ['autodocs'],
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    verdict: 'go',
    verdictLabel: 'Worth it',
    subject: 'Team plan renewal',
    headline: 'Renewing now costs less than waiting.',
    figures: [
      { label: 'Current rate', value: '$240 / yr' },
      { label: 'Renewal rate', value: '$216 / yr', kind: 'cash' },
      { label: 'Locked until', value: 'March 2028' },
    ],
    total: { label: 'You pay today', value: '$216' },
    contrast: { label: 'If you wait', value: '$264' },
    caveat: 'The lower rate holds for 14 days, then it goes back to standard pricing.',
  },
  render: () => (
    <DecisionCard
      verdict="go"
      verdictLabel="Worth it"
      subject="Team plan renewal"
      headline="Renewing now costs less than waiting."
      figures={[
        { label: 'Current rate', value: '$240 / yr' },
        { label: 'Renewal rate', value: '$216 / yr', kind: 'cash' },
        { label: 'Locked until', value: 'March 2028' },
      ]}
      total={{ label: 'You pay today', value: '$216' }}
      contrast={{ label: 'If you wait', value: '$264' }}
      caveat="The lower rate holds for 14 days, then it goes back to standard pricing."
      action={<Button variant="accent">Renew now</Button>}
      style={{ maxWidth: 420 }}
    />
  ),
};

/* There is deliberately no `HeadingLevel` story. `headline` is a real heading
   element and the type ramp is carried by the class, so a story at level 3
   renders pixel-for-pixel what `Default` renders — it would mint two visual
   baselines (light and dark) that cannot catch a regression `Default` would
   miss, in a suite already fighting baseline cost (#101, #105). The prop is
   documented where it is legible: autodocs derives it from the component's
   types, the outline change is asserted by DecisionCard.test.tsx, and the
   reasoning is on the docs page under "Heading level". */
export const WithoutAction: Story = {
  args: {
    verdict: 'no',
    verdictLabel: 'Not yet',
    subject: 'Loyalty discount',
    headline: 'This account does not qualify yet.',
    figures: [
      { label: 'Months active', value: '4' },
      { label: 'Needed', value: '12' },
    ],
    caveat: 'Eligibility is rechecked on the first of every month.',
    closing: 'I would leave it until August and look again. Nothing to do in the meantime.',
  },
  render: () => (
    <DecisionCard
      verdict="no"
      verdictLabel="Not yet"
      subject="Loyalty discount"
      headline="This account does not qualify yet."
      figures={[
        { label: 'Months active', value: '4' },
        { label: 'Needed', value: '12' },
      ]}
      caveat="Eligibility is rechecked on the first of every month."
      closing="I would leave it until August and look again. Nothing to do in the meantime."
      style={{ maxWidth: 420 }}
    />
  ),
};

/* `code` beside the headline and `figureLayout="prose"` together, because
   that is how they are used: a derivation shows an identifier, then the
   sentences it was derived from. The rows repeat their label by design, so
   each carries an `id` for its key rather than smuggling identity into
   `kind`. The 360px width is the narrow column the prose grid exists for —
   the metric layout wraps these same sentences into a right-ragged mono
   block there. */
export const Derivation: Story = {
  args: {
    verdict: 'go',
    verdictLabel: 'Matches',
    code: '8471.30',
    headline: 'Portable computer, under 10 kg',
    figureLayout: 'prose',
    figures: [
      { id: 'weight', label: 'from', value: 'Declared weight is 1.4 kg, under the 10 kg line' },
      { id: 'unit', label: 'from', value: 'Display, keyboard and processor are in one unit' },
      { id: 'rule', label: 'rule', value: 'Heading 8471, subheading .30: portable machines' },
    ],
    caveat: 'A docking station shipped in the same box is classified on its own.',
  },
  render: () => (
    <DecisionCard
      verdict="go"
      verdictLabel="Matches"
      code="8471.30"
      headline="Portable computer, under 10 kg"
      headingLevel={3}
      figureLayout="prose"
      figures={[
        { id: 'weight', label: 'from', value: 'Declared weight is 1.4 kg, under the 10 kg line' },
        { id: 'unit', label: 'from', value: 'Display, keyboard and processor are in one unit' },
        { id: 'rule', label: 'rule', value: 'Heading 8471, subheading .30: portable machines' },
      ]}
      caveat="A docking station shipped in the same box is classified on its own."
      action={<Button variant="accent">Use this code</Button>}
      style={{ maxWidth: 360 }}
    />
  ),
};
