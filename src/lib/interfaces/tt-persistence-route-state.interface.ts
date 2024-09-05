/**
 * Internal interface for storing route statuses - i.e. skipped or active - in
 * the LocalStorage.
 */
export interface TtPersistenceRouteState {
  route: string;
  method?: string;
  skip: boolean;
}
