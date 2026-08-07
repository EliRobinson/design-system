'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CommandPalette } from '@elirobinson/react/components/organisms/CommandPalette';
import { Kbd } from '@elirobinson/react/components/atoms/Kbd';

type SearchPage = { title: string; section: string; href: string };

export function SiteSearch({ pages }: { pages: SearchPage[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands = useMemo(
    () =>
      pages.map((page) => ({
        id: page.href,
        label: `${page.title} — ${page.section}`,
        onSelect: () => {
          setOpen(false);
          router.push(page.href);
        },
      })),
    [pages, router],
  );

  return (
    <>
      <button type="button" className="site-search-button" onClick={() => setOpen(true)}>
        Search
        <Kbd>⌘K</Kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} commands={commands} />
    </>
  );
}
