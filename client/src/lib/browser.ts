/** Full-page navigation to another origin (Stripe Checkout, OAuth...). Mocked in tests. */
export function redirect(url: string): void {
  window.location.assign(url);
}
