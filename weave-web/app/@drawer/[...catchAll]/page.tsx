/**
 * Catch-all for the `@drawer` parallel slot.
 *
 * When client-side navigation lands on a URL that does *not* match any of the
 * intercepted drawer pages, Next.js otherwise keeps the previously-rendered
 * drawer on screen. Matching every unmatched URL to this null component
 * ensures the drawer closes on soft-nav to non-drawer routes. See the
 * parallel-routes docs "Closing the modal" section.
 */
export default function DrawerCatchAll() {
  return null;
}
