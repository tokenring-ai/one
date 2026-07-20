/** Pure helpers for reading and editing sparse config override objects. */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export interface RedactedSensitiveValue {
  __sensitive: true;
  isSet: boolean;
}

export function isRedactedSensitiveValue(value: unknown): value is RedactedSensitiveValue {
  return isPlainObject(value) && value.__sensitive === true;
}

export function getAtPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Returns a new object with `value` set at `path`. Setting undefined deletes
 * the key and prunes parents that become empty (an object explicitly set to {}
 * at the target path itself is preserved — presence can be meaningful).
 */
export function setAtPath(root: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  if (path.length === 0) {
    return isPlainObject(value) ? value : {};
  }
  const [head, ...rest] = path as [string, ...string[]];
  const next: Record<string, unknown> = { ...root };

  if (rest.length === 0) {
    if (value === undefined) {
      delete next[head];
    } else {
      next[head] = value;
    }
    return next;
  }

  const child = setAtPath(isPlainObject(root[head]) ? (root[head] as Record<string, unknown>) : {}, rest, value);
  if (value === undefined && Object.keys(child).length === 0) {
    delete next[head];
  } else {
    next[head] = child;
  }
  return next;
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

export function deepCloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => deepCloneValue(item)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = deepCloneValue(item);
    return out as T;
  }
  return value;
}
