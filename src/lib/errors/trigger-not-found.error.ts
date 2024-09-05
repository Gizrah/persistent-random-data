export class TriggerNotFoundError extends Error {
  constructor(storeName: string, triggerName: string) {
    super(`Index trigger for '${storeName}' named '${triggerName}' was not found.`);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = TriggerNotFoundError.name; // stack traces display correctly now
  }
}
