import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './Accordion';

function Example({ type }: { type?: 'single' | 'multiple' }) {
  return (
    <Accordion type={type}>
      <AccordionItem value="a">
        <AccordionTrigger>Section A</AccordionTrigger>
        <AccordionContent>Content A</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Section B</AccordionTrigger>
        <AccordionContent>Content B</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('starts with all sections collapsed', () => {
    render(<Example />);

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section A' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Section B' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('expands a section when its trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole('button', { name: 'Section A' }));

    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section A' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses the previously open section in single mode', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole('button', { name: 'Section A' }));
    await user.click(screen.getByRole('button', { name: 'Section B' }));

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section A' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Content B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section B' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses an open section when its own trigger is clicked again (single mode)', async () => {
    const user = userEvent.setup();
    render(<Example />);

    const triggerA = screen.getByRole('button', { name: 'Section A' });
    await user.click(triggerA);
    expect(screen.getByText('Content A')).toBeInTheDocument();

    await user.click(triggerA);
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(triggerA).toHaveAttribute('aria-expanded', 'false');
  });

  it('allows multiple sections open at once in multiple mode', async () => {
    const user = userEvent.setup();
    render(<Example type="multiple" />);

    await user.click(screen.getByRole('button', { name: 'Section A' }));
    await user.click(screen.getByRole('button', { name: 'Section B' }));

    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section A' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Section B' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('closes only the toggled section in multiple mode, leaving others open', async () => {
    const user = userEvent.setup();
    render(<Example type="multiple" />);

    const triggerA = screen.getByRole('button', { name: 'Section A' });
    const triggerB = screen.getByRole('button', { name: 'Section B' });
    await user.click(triggerA);
    await user.click(triggerB);
    await user.click(triggerA);

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });

  it('wires aria-controls/aria-labelledby between trigger and content', async () => {
    const user = userEvent.setup();
    render(<Example />);

    const trigger = screen.getByRole('button', { name: 'Section A' });
    await user.click(trigger);

    const content = screen.getByText('Content A');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
  });

  it('wraps each trigger in an h3 heading by default', () => {
    render(<Example />);

    const heading = screen.getByRole('heading', { level: 3, name: 'Section A' });
    expect(within(heading).getByRole('button', { name: 'Section A' })).toBeInTheDocument();
  });

  it('uses a custom heading level when headingLevel is set', () => {
    render(
      <Accordion headingLevel={2}>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Section A' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('supports a controlled single value, deferring to the consumer over internal clicks', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Accordion type="single" value="a" onValueChange={onValueChange}>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Section B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText('Content A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Section B' }));

    // The consumer owns state in controlled mode: since it never re-rendered
    // with a new `value`, the DOM must not change on its own.
    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('supports a controlled multiple value as an array', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Accordion type="multiple" value={['a']} onValueChange={onValueChange}>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Section B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Section B' }));

    expect(onValueChange).toHaveBeenCalledWith(['a', 'b']);
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
  });

  it('throws when AccordionTrigger is used outside AccordionItem', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <Accordion>
          <AccordionTrigger>Bad</AccordionTrigger>
        </Accordion>,
      ),
    ).toThrow('AccordionTrigger/AccordionContent must be used within AccordionItem');

    consoleError.mockRestore();
  });

  it('throws when Accordion compound components are used outside Accordion', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <AccordionItem value="a">
          <AccordionTrigger>Bad</AccordionTrigger>
        </AccordionItem>,
      ),
    ).toThrow('Accordion compound components must be used within Accordion');

    consoleError.mockRestore();
  });

  // A consumer-supplied onClick must run alongside
  // the internal toggle, never replace it. Before the fix, `{...props}` was
  // spread after the hardcoded `onClick`, so this exact test failed with
  // "Content A" never appearing -- the toggle handler was fully overwritten.
  it('composes a consumer-supplied onClick with the toggle instead of replacing it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger onClick={onClick}>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    await user.click(screen.getByRole('button', { name: 'Section A' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section A' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  // `id` is internally computed and referenced by
  // AccordionContent's aria-labelledby, so it must not be overridable.
  it('keeps the trigger id and the content aria-labelledby in sync', async () => {
    const user = userEvent.setup();

    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    await user.click(screen.getByRole('button', { name: 'Section A' }));

    const trigger = screen.getByRole('button', { name: 'Section A' });
    const content = screen.getByText('Content A');
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
  });

  // An out-of-range headingLevel (reachable from
  // plain JS, `as any`, or a CMS-driven prop even though the TS type is
  // 1-6) must fall back to the default rather than crash the whole tree.
  it('falls back to the default heading level when headingLevel is out of range', () => {
    expect(() =>
      render(
        <Accordion headingLevel={0 as unknown as 1 | 2 | 3 | 4 | 5 | 6}>
          <AccordionItem value="a">
            <AccordionTrigger>Section A</AccordionTrigger>
            <AccordionContent>Content A</AccordionContent>
          </AccordionItem>
        </Accordion>,
      ),
    ).not.toThrow();

    expect(screen.getByRole('heading', { level: 3, name: 'Section A' })).toBeInTheDocument();
  });
});
