/**
 * Install browser globals for Bun tests (React Testing Library + DOMPurify).
 * Bun does not provide a jsdom test environment; preload this before tests.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const { window } = dom;

function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

defineGlobal("window", window);
defineGlobal("document", window.document);
defineGlobal("navigator", window.navigator);
defineGlobal("location", window.location);
defineGlobal("history", window.history);
defineGlobal("localStorage", window.localStorage);
defineGlobal("sessionStorage", window.sessionStorage);
defineGlobal("Storage", window.Storage);
defineGlobal("HTMLElement", window.HTMLElement);
defineGlobal("HTMLInputElement", window.HTMLInputElement);
defineGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
defineGlobal("HTMLButtonElement", window.HTMLButtonElement);
defineGlobal("Element", window.Element);
defineGlobal("Node", window.Node);
defineGlobal("DocumentFragment", window.DocumentFragment);
defineGlobal("MutationObserver", window.MutationObserver);
defineGlobal("getComputedStyle", window.getComputedStyle.bind(window));
defineGlobal("Event", window.Event);
defineGlobal("CustomEvent", window.CustomEvent);
defineGlobal("MouseEvent", window.MouseEvent);
defineGlobal("KeyboardEvent", window.KeyboardEvent);
defineGlobal("DOMParser", window.DOMParser);
defineGlobal("FileReader", window.FileReader);
defineGlobal("Blob", window.Blob);
defineGlobal("File", window.File);
defineGlobal("URL", window.URL);
defineGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
defineGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

// Keep window.globalThis aligned for libraries that compare identities
(window as unknown as { globalThis: typeof globalThis }).globalThis = globalThis;
