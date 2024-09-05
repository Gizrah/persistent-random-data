import { GenerateBase, GeneratingBase } from './generate-base.model';
import { Generator } from '../generator.class';

interface GeneratingCustom extends GeneratingBase {
  value: unknown;
  custom?: (generator: Generator) => unknown;
}

export class GenerateCustom extends GenerateBase {
  /**
   * Set the custom value.
   */
  public value: unknown;

  /**
   * Custom generation function. Useful to create  custom templates, like for
   * specific user generation templates. Parameter value supplied is the all the
   * generated data from before the function call.
   *
   * Function call is a drop-in replacement for generation. No generation is
   * done if a custom function is found. Call the generation function(s) inside
   * the function instead.
   */
  public custom?: (generator: Generator) => unknown;

  constructor(generated?: GeneratingCustom) {
    super('GenerateCustom');
    if (generated) {
      Object.assign(this, generated);
    }
  }
}
