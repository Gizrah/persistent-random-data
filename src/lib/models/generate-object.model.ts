import { Generatable } from '../interfaces/shared.type';
import { GenerateBase, GeneratingBase } from './generate-base.model';
import { GenerateResource } from '../interfaces/generate-resource.interface';

interface GeneratingObject extends GeneratingBase {
  resource?: GenerateResource;
  content: Generatable[];
}

/**
 * Generate an object of Generatable objects.
 */
export class GenerateObject extends GenerateBase implements GeneratingObject {
  /**
   * To generate a JsonLd resource, set the options. An empty object is enough.
   */
  public resource?: GenerateResource;

  /**
   * Array of Generatable objects that represent the object keys and values.
   */
  public content: Generatable[] = [];

  constructor(generate?: GeneratingObject) {
    super('GenerateObject');
    if (generate) {
      Object.assign(this, generate);
    }
  }
}
