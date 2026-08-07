'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@elirobinson/react/components/molecules/Card';

export default function WithContent() {
  return (
    <div className="demo-col">
      <Card>
        <CardHeader>
          <CardTitle>Get in touch</CardTitle>
          <CardDescription>Tell me what you need — no contracts required.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Practical AI consulting and tech support, from $150/hr.</p>
        </CardContent>
        <CardFooter>
          <Button variant="accent">Hire me</Button>
          <Button variant="secondary">Learn more</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
