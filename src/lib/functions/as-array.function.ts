// Simple to-array conversion of anything.
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asArray<T = any>(item: T | T[]): T[] {
  return Array.isArray(item) ? item : [item];
}
