'use client';

import { Badge } from '@elirobinson/react/components/atoms/Badge';
import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@elirobinson/react/components/molecules/Card';

export default function Basic() {
  return (
    <div className="demo-col">
      <Card>
        <CardHeader>
          <div className="demo-row">
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
    </div>
  );
}
