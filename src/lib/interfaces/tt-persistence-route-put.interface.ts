import { TtPersistenceJoiner } from './tt-persistence-joiner.interface';
import { TtPersistenceCombiner, TtPersistenceFormatter } from './shared.type';
import { TtPersistenceRouteFilter } from './tt-persistence-route-filter.interface';

/**
 * PUT and PATCH method options:
 *
 * - `storeName`: Override the default storeName set in the RouteMap.
 *
 * - `skip`: Skip this route, without having to change the route path or
 * removing the route or method altogether.
 *
 * - `joiner?`: Retrieve data from one or more objectStores and set them in the
 *  current object before storing or formatting the data.
 *
 * - `combiner?`: Update or change the payload data with the data from the
 * joiners if defined, or the currently stored data if not, before sending it to
 * the formatter as payload data. **This is an async function** and can be used
 * to retrieve and/or delete data from the storage before formatting the
 * payload.
 *
 * - `preformat?`: Format the current data as given via the `output` parameter
 * with the updated payload before storing the data in the objectStore. The
 * `payload` parameter will be the request body or the content of the preformat
 * function. The `stored` parameter is the currently stored value by default, or
 * if both the `preformat` and `joiner` are defined. If only the `joiner` is
 * defined, the `stored` data will be the joined data.
 *
 * - `formatter?`: Format the data object that was stored before it is returned
 * to the PUT or PATCH call.
 *
 * - `filter?`: Similar to a GET request, this adds some flexibility if more
 * than one UUID is present in the url, or if the UUID doesn't reference the
 * primary key.
 */
export interface TtPersistenceRoutePut {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Skip this method for the route.
  skip?: boolean;
  // Join data from one or more objectStores before storage.
  joiner?: TtPersistenceJoiner[];
  // Change the payload data (with joined data) before the formatter.
  combiner?: TtPersistenceCombiner;
  // Pre-format the `combine` result or payload data with the stored (if no
  // joiners or both `joiner` and `combine` are defined) or joined (if only
  // joiners are defined) data.
  preformat?: TtPersistenceFormatter;
  // Alter the returned value.
  formatter?: TtPersistenceFormatter;
  // Which UUID in the route should be used as primary key, if not the first.
  filter?: TtPersistenceRouteFilter;
}
