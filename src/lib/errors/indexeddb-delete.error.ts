export class IndexedDBDeleteError extends Error {
  constructor(storeName: string, key: string, error: DOMException | null) {
    super(
      `GeneratorPersistenceService could not delete the object at primary key: '${key}' in store '${storeName}`
      + `\r\n\r\n${error}`,
    );
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBDeleteError.name; // stack traces display correctly now
  }
}
