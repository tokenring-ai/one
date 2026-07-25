import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every(key => deepEqual(a[key], b[key]));
  }
  return false;
}

export interface RedactedSensitiveValue {
  __sensitive: true;
  isSet: boolean;
}

export function isRedactedSensitiveValue(value: unknown): value is RedactedSensitiveValue {
  return isPlainObject(value) && value.__sensitive === true;
}
