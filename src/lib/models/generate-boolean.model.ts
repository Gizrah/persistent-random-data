import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingBoolean extends GeneratingBase {
  percentageTrue?: number;
}

/**
 * Generate a boolean value.
 */
export class GenerateBoolean extends GenerateBase implements GeneratingBoolean {

  /**
   * Percentage chance a boolean will be true. Default 50.
   */
  public percentageTrue?: number;

  constructor(generate?: GeneratingBoolean) {
    super('GenerateBoolean');
    if (generate) {
      Object.assign(this, generate);
    }
  }

}
