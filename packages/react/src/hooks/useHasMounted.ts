import { useEffect, useState } from 'react';

/**
 * Reports `false` on the server and during the first client render, then `true`
 * once the component has mounted in a browser.
 *
 * Gate anything that reads a browser global *during render* on this — in this
 * package that means `createPortal(…, document.body)`, which otherwise throws
 * `ReferenceError: document is not defined` when a Next.js or Remix consumer
 * server-renders the tree. Effects and event handlers do not need it: neither
 * runs on the server.
 *
 * Returning `false` for the first client render (rather than checking
 * `typeof document` directly) is what keeps hydration clean — the client's
 * initial output has to match the server's, so both must skip the portal and
 * the content appears on the commit that follows.
 */
export function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
}
