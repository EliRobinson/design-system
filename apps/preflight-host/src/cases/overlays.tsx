import { Button } from '@elirobinson/react/components/atoms/Button';
import { CommandPalette } from '@elirobinson/react/components/organisms/CommandPalette';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@elirobinson/react/components/organisms/Dialog';

const noop = () => {};

/* #78 and #103. Open on load, so the layout check measures the modal box the
   browser placed, with nothing to click first. */
export function DialogCase() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this project?</DialogTitle>
          <DialogDescription>
            It leaves the dashboard. You can restore it from Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <Button>Archive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* #103. The palette renders inside DialogContent, so it shares .ds-dialog. */
export function CommandPaletteCase() {
  return (
    <CommandPalette
      open
      onOpenChange={noop}
      commands={[
        { id: 'new', label: 'New file', shortcut: ['⌘', 'N'], onSelect: noop },
        { id: 'open', label: 'Open file', shortcut: ['⌘', 'O'], onSelect: noop },
        { id: 'save', label: 'Save', shortcut: ['⌘', 'S'], onSelect: noop },
      ]}
    />
  );
}
