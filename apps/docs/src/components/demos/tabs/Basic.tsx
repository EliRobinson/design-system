'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elirobinson/react/components/organisms/Tabs';

export default function Basic() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p>
          Youth Football Fundamentals covers eight sessions of ball control, positioning, and
          small-sided games for ages 8-12.
        </p>
      </TabsContent>
      <TabsContent value="curriculum">
        <p>Session plans, warm-up drills, and printable session cards — one PDF per week.</p>
      </TabsContent>
      <TabsContent value="reviews">
        <p>
          &quot;My under-10s squad picked up the passing drills in one session.&quot; — Coach Priya
          Nair
        </p>
      </TabsContent>
    </Tabs>
  );
}
