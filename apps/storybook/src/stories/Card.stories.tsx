import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@design-system/react/components/molecules/Card';
import { Button } from '@design-system/react/components/atoms/Button';
import { Badge } from '@design-system/react/components/atoms/Badge';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Portfolio: Story = {
  render: () => (
    <Card style={{ maxWidth: 320 }}>
      <CardHeader>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <Badge>Food</Badge>
          <Badge>Family</Badge>
        </div>
        <CardTitle>Kids Recipes</CardTitle>
        <CardDescription>Simple, fun recipes designed for kids.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="ghost" size="sm">
          View project
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const WithContent: Story = {
  render: () => (
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <CardTitle>Get in touch</CardTitle>
        <CardDescription>Tell me what you need — no contracts required.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="t-body">Practical AI consulting and tech support, starting from $150/hr.</p>
      </CardContent>
      <CardFooter>
        <Button variant="accent">Hire Me</Button>
        <Button variant="secondary">Learn more</Button>
      </CardFooter>
    </Card>
  ),
};
