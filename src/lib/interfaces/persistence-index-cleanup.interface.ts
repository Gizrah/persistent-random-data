/**
 * Internal interface used to outline which indices need to be removed.
 */
export interface PersistenceIndexCleanup {
  storeName: string;
  indices: string[];
}
