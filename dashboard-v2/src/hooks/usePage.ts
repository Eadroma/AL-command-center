import { useEffect, useState } from 'react';
import { routeFromHash } from '../models/navigation';
export type { PageId } from '../models/navigation';
export function useRoute() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}
export function usePage() { return useRoute().page; }
