import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingPhoneNumber extends GeneratingBase {
  format?: string;
}

export class GeneratePhoneNumber extends GenerateBase {

  /**
   * Faker phone formatting options. Each pound sign will be replaced by a digit
   * upon generating. If empty, will default to a Dutch mobile number shown in
   * the example.
   *
   * @example```
   *  faker.phone.phoneNumber('+31 6## ######');
   * ```
   */
  public format?: string;


  constructor(generated?: GeneratingPhoneNumber) {
    super('GeneratePhoneNumber');
    if (generated) {
      Object.assign(this, generated);
    }
  }
}
