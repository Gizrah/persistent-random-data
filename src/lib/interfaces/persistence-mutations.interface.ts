import { PersistenceIndexCleanup } from './persistence-index-cleanup.interface';

/**
 * Internal interface that outlines which mutations to apply to the database.
 */
export interface PersistenceMutations {
  remove: string[];
  update: string[];
  indices: PersistenceIndexCleanup[];
}
