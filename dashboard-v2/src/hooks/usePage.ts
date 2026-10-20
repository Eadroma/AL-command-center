import { useEffect, useState } from 'react';
import { pageFromHash } from '../models/navigation';
import type { PageId } from '../models/navigation';

export type { PageId } from '../models/navigation';

/** Whitelist hash routes so links and browser history work without a router dependency. */
function currentPage(): PageId {
  return pageFromHash(window.location.hash);
}

export function usePage() {
  const [page, setPage] = useState<PageId>(currentPage);
  useEffect(() => {
    const update = () => setPage(currentPage());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return page;
}
