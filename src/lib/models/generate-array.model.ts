import { Generatable } from '../interfaces/shared.type';
import { GenerateBase, GeneratingBase } from './generate-base.model';
import { GenerateCollection } from '../interfaces/generate-collection.interface';
import { GeneratePrimitive } from './generate-primitive.model';

interface GeneratingArray extends GeneratingBase {
  content: Generatable | GeneratePrimitive | null;
  collection?: GenerateCollection;
  minItems?: number;
  maxItems?: number;
  sort?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  autoIncrement?: string;
}

/**
 * Generate an array of Generate objects.
 */
export class GenerateArray extends GenerateBase implements GeneratingArray {
  /**
   * Type of content to generate. Can be used to generate primitive values as
   * well as objects.
   */
  public content: Generatable | GeneratePrimitive | null;

  /**
   * Transform the generated array values into a Hydra object with members and
   * totalItems.
   */
  public collection?: GenerateCollection;

  /**
   * Minimum amount of items to generate.
   */
  public minItems?: number;

  /**
   * Maximum amount of items to generate.
   */
  public maxItems?: number;

  /**
   * Whether the content of this array needs to be sorted.
   */
  public sort?: boolean;

  /**
   * If the generated content is not a primitive, which key/value pair in each
   * generated object should be used to sort by.
   */
  public sortKey?: string;

  /**
   * If set, this key will be used to auto-increment a value according to its
   * position in the array. This only works for content that is a GenerateObject
   * with the autoIncrement as a key value. The Generatable corresponding to the
   * autoIncrement key will be converted to a GenerateCustom with an integer
   * value.
   */
  public autoIncrement?: string;

  /**
   * Direction used to sort the content.
   */
  public sortDirection?: 'asc' | 'desc';

  constructor(generate?: GeneratingArray) {
    super('GenerateArray');
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
