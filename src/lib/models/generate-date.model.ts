import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingDate extends GeneratingBase {
  format: string;
  dateRangeStart?: string | number | Date;
  dateRangeEnd?: string | number | Date;
}

/**
 * Generate a string, specifically a date.
 */
export class GenerateDate extends GenerateBase implements GeneratingDate {

  /**
   * How to format the return value, using date-fns formatting.
   */
  public format: string;

  /**
   * Earliest date to generate from, as ISO string, UNIX epoch or Date object.
   */
  public dateRangeStart?: string | number | Date;

  /**
   * Latest date to generate to, as ISO string, UNIX epoch or Date object.
   */
  public dateRangeEnd?: string | number | Date;

  constructor(generate?: GeneratingDate) {
    super('GenerateDate');
    if (generate) {
      Object.assign(this, generate);
    }
  }

}
