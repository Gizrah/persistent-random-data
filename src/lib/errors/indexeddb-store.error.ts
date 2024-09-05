export class IndexedDBStoreError extends Error {
  constructor(error: string) {
    super(`GeneratorPersistenceService store error: \r\n\r\n${error}`);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBStoreError.name; // stack traces display correctly now
  }
}
