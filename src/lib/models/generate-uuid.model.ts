import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingUuid extends GeneratingBase {
  prefix?: string;
  suffix?: string;
}

/**
 * Generate a string, specifically a UUID.
 */
export class GenerateUuid extends GenerateBase implements GeneratingUuid {

  /**
   * Prefix the UUID with a string. Useful for creating urls or iris.
   */
  public prefix?: string;

  /**
   * Append the UUID with a string. Useful for creating urls or iris.
   */
  public suffix?: string;

  constructor(generate?: GeneratingUuid) {
    super('GenerateUuid');
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
