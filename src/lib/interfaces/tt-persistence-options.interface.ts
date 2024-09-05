import { TtDeleteCascade } from './tt-delete-cascade.enum';
import { TtPersistenceIndexTrigger } from './tt-persistence-index-trigger.interface';

/**
 * Persistence options allow for fine-tuning aspects of the object and its
 * properties that are going to be persisted.
 *
 * - `objectName`: Name for the objectStore, or 'table', that will be created
 * based on the properties of this object. This name is unique and any existing
 * objectStore will be overwritten. Required.
 *
 * - `primaryKey`: Property name that holds or contains a UUID (like an IRI) or other
 * unique value (i.e. email address) that will be used as content for the
 * 'primary key' of the objectStore. Required.
 *
 * - `uniqueKeys`: A list of keys for properties in the content that will be
 * stored of which the values must be unique. Optional.
 *
 * - `linkedKeys`: A map in which object property relations are set. If the
 * object property's content is filled by content from a different objectStore,
 * add the PersistenceOptions for that store.
 *
 * - `storeContent`: Whether to store the content after the persistence process
 * creates one or more objectStores for the given content. Default is true. If
 * set to false, only the database settings will be created for the various
 * objectStores.
 *
 * - `cascade`: If this content is linked by other content and that item is
 * deleted, the cascading options defined here will be used. If no cascading
 * option is set, the data will be kept.
 *
 * - `triggers`: One or more combinations of UUID and HttpParam values that
 * combine to create custom, unique indices for the objectStore that will
 * greatly enhance the speed at which data is retrieved from objectStores with
 * many records. Optional.
 */
export interface TtPersistenceOptions {
  // Name for the objectStore. Unique, or will be overwritten.
  storeName: string;
  // Name for the key that includes the UUID or other unique value.
  primaryKey: string;
  // List of keys that can only have unique values.
  uniqueKeys?: string[];
  // Map with object keys that have their own linking options.
  linkedKeys?: Map<string, TtPersistenceOptions>;
  // Store the content after creating the objectStore. Default true.
  storeContent?: boolean;
  // When deleting, this linked content will be pruned as.
  cascade?: TtDeleteCascade;
  // One or more triggers for certain param/url combinations.
  triggers?: TtPersistenceIndexTrigger[];
}
