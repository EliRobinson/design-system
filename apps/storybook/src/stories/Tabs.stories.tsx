import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system/react/components/Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="services">
      <TabsList>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      <TabsContent value="services">
        <p className="t-body">AI consulting and tech support — practical, no-fluff.</p>
      </TabsContent>
      <TabsContent value="portfolio">
        <p className="t-body">Kids Recipes, Maths, and coaching guides.</p>
      </TabsContent>
      <TabsContent value="about">
        <p className="t-body">I&apos;m Eli Robinson — builder, consultant, founder.</p>
      </TabsContent>
    </Tabs>
  ),
};
