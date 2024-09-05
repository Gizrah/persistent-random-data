import { Generatable } from '../interfaces/shared.type';

export class GeneratableKeyNotFoundError extends Error {
  constructor(generatable: Generatable, parent?: Generatable) {
    const message: string = `Generatable ${generatable.constructor.name} does not have a valid key name.`;
    const partof: string = parent && parent?.key
      ? ` ${generatable.constructor.name} is part of ${parent.constructor.name} '${parent.key}'.`
      : '';

    super(message + partof);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = GeneratableKeyNotFoundError.name; // stack traces display correctly now
  }
}
