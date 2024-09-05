/**
 * Heavily inspired simple sorting function from/for MatSort, usable for strings
 * and numbers.
 */
export function simpleCompare(a: number | string, b: number | string, isAsc: boolean): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
