import { TtPersistenceFormatter } from './shared.type';

/**
 * To join data from a different objectStore, some information is needed. In
 * addition, the data that is retrieved can be formatted with a custom
 * formatter, so the joined data can be pruned accordingly.
 *
 * - `storeName`: The objectStore to retrieve the data from.
 *
 * - `property`: Defines which property in the initial object holds the value to
 * filter and/or find objects for in the joining objectStore. If left empty, the
 * primary key is used.
 *
 * - `index`: Reference an objectStore index column directly, where the content
 * of the property value will be matched. If undefined, the primary key column
 * is used. If the index also references a nested primary key value, make sure
 * to set `primaryKey` to true.
 *
 * - `primaryKey`: If the `index` references an object in which the primary key
 * should be referenced, set this to true. It will append the internal primary
 * key object property to the index.
 *
 * - `joinOn`: Defines the property to put the joining data on the initial
 * object. If left empty, the joining data is combined with the original object.
 *
 * - `multiple`: Optional toggle to ensure the retrieved data is always returned
 * as an array if set to true, or if set to false, always returned as an object.
 * If an array is retrieved and an object is expected, will always return the
 * first item.
 *
 * - `getLinked`: Optional toggle to enable retrieval of linked data, which is
 * defined by the PersistenceOptions for the objectStore. Defaults to false.
 *
 * - `formatter`: Default formatter function as used by the RouteMap and the
 * Module config. If set, allows for formatting the joining data before it is
 * added to the original object.
 */
export interface TtPersistenceJoiner {
  // ObjectStore name to get the joining data from.
  storeName: string;
  // Which property in the initial object holds the value to a joining object.
  property: string;
  // If the property value references a nested value in the objectStore, supply
  // a (dot-notated) index to the path.
  index?: string;
  // If the index references a primary key column, set this value to true.
  primaryKey?: boolean;
  // Which property to put the joined object. If unset, appends original object.
  joinOn?: string;
  // Whether to expect and/or always return values as an array. Default false.
  multiple?: boolean;
  // Retrieve the linked data as well as the initial join object? Default false.
  getLinked?: boolean;
  // Optional formatter to format the content of the joining object.
  formatter?: TtPersistenceFormatter;
}
