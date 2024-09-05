import { PersistenceMutations } from './persistence-mutations.interface';
import { PersistenceOptionsTrigger } from './persistence-options-trigger.interface';
import { TtPersistenceOptions } from './tt-persistence-options.interface';

/**
 * Persistence settings interface, used to type the content of the service's
 * own database objectStore. This is an internal interface.
 */
export interface PersistenceSettings {
  // Database version
  version: number;
  // Map of objectStore names and their options as an array.
  options: [string, TtPersistenceOptions][];
  // Map to array of objectStore -> [property, linkedStore]
  links: [string, [string, string][]][];
  // Which objectStores have updated, removed and/or cleaned up.
  mutations: PersistenceMutations;
  // An array of custom indices for specific objectStores.
  triggers: PersistenceOptionsTrigger[];
}
