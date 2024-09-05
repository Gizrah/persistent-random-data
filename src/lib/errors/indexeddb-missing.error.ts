export class IndexedDBMissingError extends Error {
  constructor() {
    super('GeneratorPersistenceService could not access the database instance, it seems to be missing.');
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = IndexedDBMissingError.name; // stack traces display correctly now
  }
}
