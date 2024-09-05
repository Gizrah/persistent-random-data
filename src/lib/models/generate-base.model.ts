export interface GeneratingBase {
  key: string;
  allowNull?: boolean;
  percentageNull?: number;
  allowOptions?: boolean;
  percentageOptional?: number;
}

/**
 * Base class for all GenerateX classes. Because the custom function imports
 * this file and all other classes use this class and are imported in this file
 * again, it's set here so no circular dependencies exist.
 */
export abstract class GenerateBase {
  /**
   * Key name used when generating the object.
   */
  public key: string;

  /**
   * Allow the generation to insert nulls. Default false.
   */
  public allowNull?: boolean;

  /**
   * If allowNull is true, what percentage of items will be given a null value.
   * Default 10.
   */
  public percentageNull?: number;

  /**
   * Allow the generation to insert undefined (optional) values. Default false.
   */
  public allowOptional?: boolean;

  /**
   * If allowOptional is true, what percentage of items will be skipped or set
   * as undefined. Default 10.
   */
  public percentageOptional?: number;

  /**
   * Name of the class, since Angular minifies the names of instances on AoT
   * compilation.
   */
  public readonly className: string;

  protected constructor(className: string) {
    this.className = className;
  }
}
