import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingWord extends GeneratingBase {
  minLength?: number;
  maxLength?: number;
  capitalize?: boolean;
  exclude?: string[];
  prefix?: string;
}

/**
 * Generate a string, specifically a word.
 */
export class GenerateWord extends GenerateBase implements GeneratingWord {
  /**
   * Minimum amount of characters the word can be.
   */
  public minLength?: number;

  /**
   * Maximum amount of characters the word can be.
   */
  public maxLength?: number;

  /**
   * Make the first letter of this word a capital letter.
   */
  public capitalize?: boolean;

  /**
   * If set, will attempt to generate a word that is not part of the list of
   * excluded strings.
   */
  public exclude?: string[];

  /**
   * Prefix the generated word with something.
   */
  public prefix?: string;

  /**
   * Counter to prevent too many retries of triggering a stack overflow.
   */
  private retried: number = 0;

  constructor(generate?: GeneratingWord) {
    super('GenerateWord');
    if (generate) {
      Object.assign(this, generate);
    }
  }

  /**
   * Get the number of retries.
   */
  public get retries(): number {
    return this.retried;
  }

  /**
   * Increase the retry counter.
   */
  public retry(): void {
    this.retried += 1;
  }
}
