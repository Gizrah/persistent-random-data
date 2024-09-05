export class IndexedDBUnsupportedError extends Error {
  constructor() {
    super('Your browser does not support a stable version of IndexedDB. Generation will not be persistent.');
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBUnsupportedError.name; // stack traces display correctly now
  }
}
