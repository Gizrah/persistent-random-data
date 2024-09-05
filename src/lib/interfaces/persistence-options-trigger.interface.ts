import { TtPersistenceIndexTriggerParam, TtPersistenceIndexTriggerUuid } from './tt-persistence-index-trigger.interface';

export type PersistenceIndexTriggerRule = TtPersistenceIndexTriggerUuid | TtPersistenceIndexTriggerParam;

/**
 * Extension of the {@see PersistenceIndexTrigger}. Internal interface.
 */
export interface PersistenceOptionsTrigger {
  name: string;
  storeName: string;
  index: string;
  keyPath: string[];
  searchIn?: [string, string[]][];
  rules: PersistenceIndexTriggerRule[];
}
