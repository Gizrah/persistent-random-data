export class NoPrimaryKeyInUrlError extends Error {
  constructor(method: string, storeName: string, url: string) {
    super(
      `Attempted to ${method} data for '${storeName}', `
      + 'but no UUID or matcher value could be extracted from the url: \r\n'
      + url,
    );
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = NoPrimaryKeyInUrlError.name; // stack traces display correctly now
  }
}
