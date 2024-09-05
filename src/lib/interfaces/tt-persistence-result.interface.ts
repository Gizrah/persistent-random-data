/**
 * Persistence results object, returned when the persist function is called.
 * Summary of storeName, all created indices and amount of rows added.
 */
export interface TtPersistenceResult {
  storeName: string;
  indices: string[];
  rows: number;
}
