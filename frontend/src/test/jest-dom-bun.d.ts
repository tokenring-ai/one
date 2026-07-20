import { type expect } from "bun:test";

declare module "bun:test" {
  interface Matchers<T = any> extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, T> {}
}

interface TestingLibraryMatchers<_E, R> {
  toBeInTheDOM(container?: HTMLElement | SVGElement): R;
  toBeInTheDocument(): R;
  toBeVisible(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toBeEmpty(): R;
  toBeEmptyDOMElement(): R;
  toBeInvalid(): R;
  toBeRequired(): R;
  toBeValid(): R;
  toContainElement(element: HTMLElement | SVGElement | null): R;
  toContainHTML(htmlText: string): R;
  toHaveAttribute(attr: string, value?: unknown): R;
  toHaveClass(...classNames: string[]): R;
  toHaveFocus(): R;
  toHaveFormValues(expectedValues: Record<string, unknown>): R;
  toHaveStyle(css: Record<string, unknown> | string): R;
  toHaveTextContent(text: string | RegExp | Array<string | RegExp>, options?: { normalizeWhitespace: boolean }): R;
  toHaveValue(value?: string | string[] | number): R;
  toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
  toBeChecked(): R;
  toBePartiallyChecked(): R;
  toHaveDescription(text?: string | RegExp | HTMLElement | SVGElement): R;
  toHaveErrorMessage(text?: string | RegExp | HTMLElement | SVGElement): R;
}
