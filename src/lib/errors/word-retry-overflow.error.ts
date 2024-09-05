import { GenerateWord } from '../models/generate-word.model';

export class WordRetryOverflowError extends Error {
  constructor(generated: GenerateWord) {
    const message: string = `Attempted to generate a word for key ${generated.key} with the set minLength`
    + `(${generated.minLength}) and set maxLength (${generated.maxLength}) values (or at least 3 and at least 10), `
    + 'but generation could not find a suitable word. Change the generation settings for this key.';

    super(message);
    // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = WordRetryOverflowError.name; // stack traces display correctly now
  }
}
