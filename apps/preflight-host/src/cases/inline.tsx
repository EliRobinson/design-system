import { Button } from '@elirobinson/react/components/atoms/Button';
import { Input } from '@elirobinson/react/components/atoms/Input';
import { Textarea } from '@elirobinson/react/components/atoms/Textarea';
import { Select } from '@elirobinson/react/components/organisms/Select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elirobinson/react/components/organisms/Tabs';

/* Layout is Tailwind utilities on purpose: this is a Tailwind consumer, and
   the utilities are part of what meets our CSS here. */

/* #126. Each control on its own row, so the check can read its height alone. */
export function FormControlsCase() {
  return (
    <div className="grid w-[420px] gap-6">
      <Input label="Email" placeholder="you@example.com" />
      <Select label="Sport" defaultValue="">
        <option value="">Choose a sport</option>
        <option value="football">Football</option>
      </Select>
      <Textarea label="Notes" placeholder="Anything we should know" />
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <p className="t-body">AI consulting and tech support.</p>
        </TabsContent>
        <TabsContent value="portfolio">
          <p className="t-body">Kids Recipes, Maths, and coaching guides.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* #112. The three anchors from that issue's table, and one nobody styled. */
export function LinkColourCase() {
  return (
    <div className="grid gap-4">
      <p className="t-body">
        A{' '}
        <a href="#plain" data-probe="plain">
          plain link
        </a>{' '}
        keeps the link colour and underline.
      </p>
      <a href="#cta" className="text-accent-foreground" data-probe="accent-foreground">
        Accent foreground
      </a>
      <a href="#muted" className="text-muted-foreground" data-probe="muted-foreground">
        Muted foreground
      </a>
      <a href="#ink" className="text-accent-ink no-underline" data-probe="accent-ink">
        Accent ink, no underline
      </a>
    </div>
  );
}

/* #251. A colour utility on two `.t-*` elements, and one with none. A colour
   on a PARENT is left out on purpose: a declared value beats an inherited one
   in any layer, so it never reaches a `.t-*` child, and tokens.css says so. */
export function TypeColourCase() {
  return (
    <div className="grid gap-4">
      <p className="t-caption" data-probe="caption">
        A caption with no colour utility
      </p>
      <p className="t-caption text-destructive-ink" data-probe="caption-destructive">
        Failed to save
      </p>
      <p className="t-body text-accent-ink" data-probe="body-accent">
        Body text in the accent ink
      </p>
    </div>
  );
}

/* #250. Tailwind's own size and the design system's shell width, side by
   side. Each bar fills its cap, so the cap is the bar's width. */
export function ShellWidthsCase() {
  return (
    <div className="grid w-[960px] gap-6">
      <div className="w-full max-w-md bg-muted p-4" data-probe="tailwind-md">
        <p className="t-body">Tailwind max-w-md</p>
      </div>
      <div className="w-full max-w-(--shell-md) bg-muted p-4" data-probe="shell-md">
        <p className="t-body">max-w-(--shell-md)</p>
      </div>
    </div>
  );
}

/* #34. Body text, a `.t-*` class, a Tailwind utility and two components, so
   the check covers each way the family reaches a consumer's page. */
export function FontOverrideCase() {
  return (
    <div className="grid w-[420px] gap-6">
      <p data-probe="body">Body text in the framework&apos;s font.</p>
      <p className="t-body" data-probe="type-class">
        A type class in the framework&apos;s font.
      </p>
      <p className="font-sans" data-probe="utility">
        A font-sans utility in the framework&apos;s font.
      </p>
      <div>
        <Button data-probe="button">Save changes</Button>
      </div>
      <Input label="Name" placeholder="Ada Lovelace" data-probe="input" />
    </div>
  );
}
