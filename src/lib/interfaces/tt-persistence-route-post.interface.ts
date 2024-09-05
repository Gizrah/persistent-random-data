import { TtPersistenceJoiner } from './tt-persistence-joiner.interface';
import { TtPersistenceCombiner, TtPersistenceFormatter } from './shared.type';

/**
 * POST method options:
 *
 * - `storeName`: Override the default storeName set in the RouteMap.
 *
 * - `skip`: Skip this route, without having to change the route path or
 * removing the route or method altogether.
 *
 * - `joiner?`: Retrieve data from one or more objectStores and set them in the
 * current object before storing the data.
 *
 * - `combiner?`: Update or change the payload data with the data from the
 * joiners if defined, or the currently stored data if not, before sending it to
 * the formatter as payload data. **This is an async function** and can be used
 * to retrieve and/or delete data from the storage before formatting the
 * payload.
 *
 * - `preformat?`: Instead of adding the data as-is, if the data needs a bit of
 * adjustment, or if the joined data needs to be changed before storage, the
 * formatter will be called before the data is stored. Because there is no
 * existing data, the `output` parameter data will be empty, unless a combiner
 * function is defined, in which case the parameter will be the output data of
 * that function.
 *
 * - `formatter?`: Format the data object that was stored before it is returned
 * to the POST call.
 */
export interface TtPersistenceRoutePost {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Skip this method for the route.
  skip?: boolean;
  // Join data from one or more objectStores before storage.
  joiner?: TtPersistenceJoiner[];
  // Adjust the current (payload) data before sending it to the formatter.
  combiner?: TtPersistenceCombiner;
  // Adjust the data before storing it in the objectStore.
  preformat?: TtPersistenceFormatter;
  // Alter the newly stored data before returning it to the call.
  formatter?: TtPersistenceFormatter;
}
