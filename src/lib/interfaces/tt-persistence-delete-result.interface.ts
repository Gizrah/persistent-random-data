import { TtDeleteCascade } from './tt-delete-cascade.enum';
import { Unknown } from './shared.type';

/**
 * The detailed result of a delete action.
 */
export interface TtPersistenceDeleteResult {
  // ObjectStore it applied to.
  storeName: string;
  // Which primary keys were affected.
  primaryKeys: string[];
  // Which nested paths were changed.
  path: string;
  // How the data was altered.
  type: TtDeleteCascade;
  // Internal, set of items that will be adjusted.
  content?: Set<Unknown>;
}
