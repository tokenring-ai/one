import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface RedactedSensitiveValue {
  __sensitive: true;
  isSet: boolean;
}

export function isRedactedSensitiveValue(value: unknown): value is RedactedSensitiveValue {
  return isPlainObject(value) && value.__sensitive === true;
}
