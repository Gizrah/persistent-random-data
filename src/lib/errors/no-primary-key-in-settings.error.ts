export class NoPrimaryKeyInSettingsError extends Error {
  constructor(storeName: string) {
    super(`The settings for '${storeName}' are missing or incomplete: primary key value not found.`);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = NoPrimaryKeyInSettingsError.name; // stack traces display correctly now
  }
}
