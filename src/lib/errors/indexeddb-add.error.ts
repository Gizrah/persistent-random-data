export class IndexedDBAddError extends Error {
  constructor(storeName: string, messages: string[]) {
    super(`Failed to add content to objectStore '${storeName}': \r\n${messages.join('\r\n')}`);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBAddError.name; // stack traces display correctly now
  }
}
