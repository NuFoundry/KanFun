import "@testing-library/jest-dom";
// Components call t(); load the real English strings so tests can assert on visible text.
import "@/i18n";

// jsdom does not implement matchMedia (used by use-mobile and theme detection).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

// Radix components, toasts and the chat log call these in jsdom.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.scrollTo = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = jest.fn();
window.HTMLElement.prototype.setPointerCapture = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
// Radix measures checkboxes and popovers inside dialogs; jsdom has no ResizeObserver.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
