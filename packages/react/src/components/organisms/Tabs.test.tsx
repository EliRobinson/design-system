import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

describe('Tabs', () => {
  it('shows the default tab panel', () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel one</TabsContent>
        <TabsContent value="two">Panel two</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Panel one')).toBeInTheDocument();
    expect(screen.queryByText('Panel two')).not.toBeInTheDocument();
  });

  it('switches panels when a tab is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel one</TabsContent>
        <TabsContent value="two">Panel two</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: 'Two' }));

    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Panel two')).toBeInTheDocument();
    expect(screen.queryByText('Panel one')).not.toBeInTheDocument();
  });

  it('calls onValueChange when controlled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Tabs defaultValue="one" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel one</TabsContent>
        <TabsContent value="two">Panel two</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: 'Two' }));

    expect(onValueChange).toHaveBeenCalledWith('two');
  });

  describe('keyboard navigation', () => {
    function renderTabs(props?: {
      defaultValue?: string;
      onValueChange?: (value: string) => void;
    }) {
      return render(
        <Tabs defaultValue={props?.defaultValue ?? 'one'} onValueChange={props?.onValueChange}>
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
            <TabsTrigger value="three">Three</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
          <TabsContent value="three">Panel three</TabsContent>
        </Tabs>,
      );
    }

    const tab = (name: string) => screen.getByRole('tab', { name });

    it('puts the tab stop on the active tab', async () => {
      const user = userEvent.setup();
      renderTabs({ defaultValue: 'two' });

      await user.tab();

      expect(tab('Two')).toHaveFocus();
      expect(tab('One')).toHaveAttribute('tabindex', '-1');
      expect(tab('Three')).toHaveAttribute('tabindex', '-1');
    });

    it('moves focus forward with ArrowRight and ArrowDown', async () => {
      const user = userEvent.setup();
      renderTabs();

      await user.tab();
      expect(tab('One')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('Two')).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(tab('Three')).toHaveFocus();
    });

    it('moves focus backward with ArrowLeft and ArrowUp', async () => {
      const user = userEvent.setup();
      renderTabs({ defaultValue: 'three' });

      await user.tab();
      expect(tab('Three')).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(tab('Two')).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(tab('One')).toHaveFocus();
    });

    it('wraps forward from the last tab to the first', async () => {
      const user = userEvent.setup();
      renderTabs({ defaultValue: 'three' });

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(tab('One')).toHaveFocus();
    });

    it('wraps backward from the first tab to the last', async () => {
      const user = userEvent.setup();
      renderTabs();

      await user.tab();
      await user.keyboard('{ArrowLeft}');

      expect(tab('Three')).toHaveFocus();
    });

    it('jumps to the first tab with Home and the last with End', async () => {
      const user = userEvent.setup();
      renderTabs({ defaultValue: 'two' });

      await user.tab();

      await user.keyboard('{End}');
      expect(tab('Three')).toHaveFocus();

      await user.keyboard('{Home}');
      expect(tab('One')).toHaveFocus();
    });

    it('moves focus without activating the tab', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderTabs({ onValueChange });

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(tab('Two')).toHaveFocus();
      expect(tab('Two')).toHaveAttribute('aria-selected', 'false');
      expect(tab('One')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Panel one')).toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('activates the focused tab with Enter', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderTabs({ onValueChange });

      await user.tab();
      await user.keyboard('{ArrowRight}{Enter}');

      expect(tab('Two')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Panel two')).toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledWith('two');
    });

    it('activates the focused tab with Space', async () => {
      const user = userEvent.setup();
      renderTabs();

      await user.tab();
      await user.keyboard('{ArrowRight}[Space]');

      expect(tab('Two')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Panel two')).toBeInTheDocument();
    });

    it('scopes navigation to its own tablist when two are on the page', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Tabs defaultValue="a1">
            <TabsList aria-label="First">
              <TabsTrigger value="a1">A1</TabsTrigger>
              <TabsTrigger value="a2">A2</TabsTrigger>
            </TabsList>
            <TabsContent value="a1">Panel a1</TabsContent>
            <TabsContent value="a2">Panel a2</TabsContent>
          </Tabs>
          <Tabs defaultValue="b1">
            <TabsList aria-label="Second">
              <TabsTrigger value="b1">B1</TabsTrigger>
              <TabsTrigger value="b2">B2</TabsTrigger>
            </TabsList>
            <TabsContent value="b1">Panel b1</TabsContent>
            <TabsContent value="b2">Panel b2</TabsContent>
          </Tabs>
        </>,
      );

      await user.tab();
      expect(tab('A1')).toHaveFocus();

      await user.keyboard('{End}');
      expect(tab('A2')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('A1')).toHaveFocus();
      expect(tab('B1')).not.toHaveFocus();
    });

    it('skips disabled triggers, including when wrapping', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two" disabled>
              Two
            </TabsTrigger>
            <TabsTrigger value="three">Three</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
          <TabsContent value="three">Panel three</TabsContent>
        </Tabs>,
      );

      await user.tab();
      expect(tab('One')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('Three')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('One')).toHaveFocus();

      await user.keyboard('{End}');
      expect(tab('Three')).toHaveFocus();
    });

    it('leaves other keys to the consumer', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();

      render(
        <Tabs defaultValue="one">
          <TabsList onKeyDown={onKeyDown}>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
        </Tabs>,
      );

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(onKeyDown).toHaveBeenCalled();
      expect(tab('Two')).toHaveFocus();
    });
  });

  describe('disabled active trigger fallback', () => {
    const tab = (name: string) => screen.getByRole('tab', { name });

    it('falls back the tab stop to the first focusable trigger when the active trigger is disabled', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one" disabled>
              One
            </TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
            <TabsTrigger value="three">Three</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
          <TabsContent value="three">Panel three</TabsContent>
        </Tabs>,
      );

      await user.tab();

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(tab('Two'));
      expect(tab('Two')).toHaveFocus();

      // A tablist exposes exactly one tab stop. The active trigger normally
      // owns it, but this one is disabled and can never take focus, so
      // ownership moves to the first focusable trigger -- and moves *away*
      // from the disabled one, rather than leaving a second, dead tabindex=0
      // behind.
      expect(tab('One')).toHaveAttribute('tabindex', '-1');
      expect(tab('Two')).toHaveAttribute('tabindex', '0');
      expect(tab('Three')).toHaveAttribute('tabindex', '-1');
      expect(
        screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0'),
      ).toHaveLength(1);
    });

    it('still arrow-navigates and skips disabled triggers from the fallback position', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one" disabled>
              One
            </TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
            <TabsTrigger value="three">Three</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
          <TabsContent value="three">Panel three</TabsContent>
        </Tabs>,
      );

      await user.tab();
      expect(tab('Two')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('Three')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab('Two')).toHaveFocus();
    });

    it('does not throw when every trigger is disabled', async () => {
      const user = userEvent.setup();

      expect(() =>
        render(
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one" disabled>
                One
              </TabsTrigger>
              <TabsTrigger value="two" disabled>
                Two
              </TabsTrigger>
            </TabsList>
            <TabsContent value="one">Panel one</TabsContent>
            <TabsContent value="two">Panel two</TabsContent>
          </Tabs>,
        ),
      ).not.toThrow();

      await expect(user.tab()).resolves.not.toThrow();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
