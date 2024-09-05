import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingNumber extends GeneratingBase {
  min?: number;
  max?: number;
  precision?: number;
}

/**
 * Generate a number.
 */
export class GenerateNumber extends GenerateBase implements GeneratingNumber {
  /**
   * Lowest number that can be generated.
   */
  public min?: number;

  /**
   * Highest number that can be generated.
   */
  public max?: number;

  /**
   * If the number is a float, set the precision of the value.
   *
   * @example ```
   *  { min: 10, max: 100, precision: 0.01 } // 26.81
   * ```
   */
  public precision?: number;

  constructor(generate?: GeneratingNumber) {
    super('GenerateNumber');
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
