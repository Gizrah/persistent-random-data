import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingEmail extends GeneratingBase {
  firstName?: string;
  lastName?: string;
  domain?: string;
}

/**
 * Generate a string, specifically an email address.
 */
export class GenerateEmail extends GenerateBase implements GeneratingEmail {

  /**
   * Person's first name.
   */
  public firstName?: string;

  /**
   * Person's last name. Create a single string of the prefix and last name if
   * applicable.
   */
  public lastName?: string;

  /**
   * Generate the email address with a default domain.
   */
  public domain?: string;

  constructor(generate?: GeneratingEmail) {
    super('GenerateEmail');
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
