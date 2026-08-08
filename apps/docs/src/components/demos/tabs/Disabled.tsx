'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elirobinson/react/components/organisms/Tabs';

export default function Disabled() {
  return (
    <Tabs defaultValue="football">
      <TabsList>
        <TabsTrigger value="football">Football</TabsTrigger>
        <TabsTrigger value="basketball" disabled>
          Basketball (sold out)
        </TabsTrigger>
        <TabsTrigger value="rugby">Rugby</TabsTrigger>
      </TabsList>
      <TabsContent value="football">
        <p>Youth Football Fundamentals — 8 sessions, ages 8-12.</p>
      </TabsContent>
      <TabsContent value="basketball">
        <p>Basketball Conditioning is fully booked for this term.</p>
      </TabsContent>
      <TabsContent value="rugby">
        <p>Rugby Contact Basics — 6 sessions, ages 10-14.</p>
      </TabsContent>
    </Tabs>
  );
}
