
let groups: number = 0;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function log(...args: any[]): void {
  console.log(...args);
}

export function warn(...args: any[]): void {
  console.warn(...args);
}

export function danger(...args: any[]): void {
  console.error(...args);
}

export function table(...args: any[]): void {
  console.table(...args);
}

export function logStart(...args: any[]): void {
  console.groupCollapsed(...args);
  groups++;
}

export function logEnd(...args: any[]): void {
  if (args) {
    console.log(...args);
  }
  console.groupEnd();
  if (groups > 0) {
    groups--;
  }
}

export function logEndAll(): void {
  if (groups === 0) {
    return;
  }

  for (let i: number = groups; i > 0; i--) {
    console.groupEnd();
  }
}

export function doLog(state: boolean, type: Function, ...args: any[]): void {
  if (!state) {
    return;
  }

  type(...args);
}
