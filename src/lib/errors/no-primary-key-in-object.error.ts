export class NoPrimaryKeyInObjectError extends Error {
  constructor(storeName: string, idKey: string) {
    super(
      `Attempted to add data in store '${storeName}',`
      + `but the primary key value for '${idKey}' in the object was empty.`,
    );
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = NoPrimaryKeyInObjectError.name; // stack traces display correctly now
  }
}
