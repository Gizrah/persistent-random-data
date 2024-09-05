export class TtPersistenceFormatterMissingError extends Error {
  constructor(route: string) {
    const message: string = 'TtPersistenceConfig: Formatter function is required when format is enabled. '
    + `The route "${route}" has format enabled, but no formatter function is found. Add a general formatting `
    + 'function in the config object or define a custom function in the route map object.';

    super(message);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = TtPersistenceFormatterMissingError.name; // stack traces display correctly now
  }
}
