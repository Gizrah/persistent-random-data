import { TtPersistenceFormatter } from './shared.type';
import { TtPersistenceRouteFilter } from './tt-persistence-route-filter.interface';

/**
 * DELETE method options:
 *
 * - `storeName`: Override the default storeName set in the RouteMap.
 *
 * - `formatter`: Format the reply, similar to the other method actions, meaning
 * that the request and the previously stored content are available to use to
 * create a reply. Default returns one or more {@see DeleteResult} objects with
 * the action results.
 *
 * - `filter?`: Similar to a GET request, this adds some flexibility if more
 * than one UUID is present in the url, or if the UUID doesn't reference the
 * primary key.
 *
 * **Please note**: Cascading options are defined in the PersistenceOptions for
 * each of the objectStores. If no cascade option is defined, the data is kept!
 */
export interface TtPersistenceRouteDelete {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Alter default DeleteResult reply to something containing the stored value.
  formatter?: TtPersistenceFormatter;
  // Which UUID in the route should be used as primary key, if not the first.
  filter?: TtPersistenceRouteFilter;
}
