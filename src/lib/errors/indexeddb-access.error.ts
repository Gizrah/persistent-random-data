export class IndexedDBAccessError extends Error {
  constructor(error: DOMException | null) {
    super(`GeneratorPersistenceService could not open the IndexedDB database: \r\n\r\n${error}`);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBAccessError.name; // stack traces display correctly now
  }
}
