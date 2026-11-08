import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@design-system/react/components/organisms/Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: 'services', children: null },
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

/** When the tabs do not fit, the list scrolls sideways inside itself and the
 *  active tab is scrolled into view. */
export const Narrow: Story = {
  args: { defaultValue: 'reviews', children: null },
  render: () => (
    <div style={{ width: 240 }}>
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="t-body">Eight sessions of ball control and small-sided games.</p>
        </TabsContent>
        <TabsContent value="curriculum">
          <p className="t-body">Session plans, warm-up drills and printable cards.</p>
        </TabsContent>
        <TabsContent value="reviews">
          <p className="t-body">The under-10s picked up the passing drills in one session.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
