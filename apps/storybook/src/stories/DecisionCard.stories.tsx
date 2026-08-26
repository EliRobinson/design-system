import type { Meta, StoryObj } from '@storybook/react-vite';
import { DecisionCard } from '@design-system/react/components/organisms/DecisionCard';
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

/* `headline` is a real heading element, so the only thing this story changes is
   the document outline — it looks identical to Default by design. Inspect the
   rendered markup to see the <h3>. */
export const HeadingLevelThree: Story = {
  args: {
    verdict: 'go',
    verdictLabel: 'Worth it',
    headingLevel: 3,
    subject: 'Team plan renewal',
    headline: 'Renewing now costs less than waiting.',
    caveat: 'This card sits inside an <h2> section, so its headline is an <h3>.',
  },
  render: () => (
    <DecisionCard
      verdict="go"
      verdictLabel="Worth it"
      headingLevel={3}
      subject="Team plan renewal"
      headline="Renewing now costs less than waiting."
      caveat="This card sits inside an <h2> section, so its headline is an <h3>."
      style={{ maxWidth: 420 }}
    />
  ),
};

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
