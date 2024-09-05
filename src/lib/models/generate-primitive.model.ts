import { GeneratableString } from '../interfaces/shared.type';
import { GenerateBoolean } from './generate-boolean.model';
import { GenerateNumber } from './generate-number.model';
import { Generator } from '../generator.class';

interface GeneratingPrimitive {
  content: GenerateNumber | GeneratableString | GenerateBoolean;
  custom?: (generator: Generator) => string | boolean | number;
}

/**
 * Generate a primitive value instead of an object, using the generation objects
 * associated with the primitive types.
 */
export class GeneratePrimitive implements GeneratingPrimitive {

  /**
   * Object class associated with the primitive type.
   */
  public content: GenerateNumber | GeneratableString | GenerateBoolean;

  /**
   * Custom generation for primitive values. {@see GenerateBase.custom} for more
   * info.
   */
  public custom?: (generator: Generator) => string | boolean | number;

  constructor(generate?: GeneratingPrimitive) {
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
