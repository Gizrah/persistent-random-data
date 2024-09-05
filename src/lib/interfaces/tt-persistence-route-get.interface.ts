import { TtPersistenceJoiner } from './tt-persistence-joiner.interface';
import { TtPersistenceFormatter, TtPersistenceRouteFilterFunction } from './shared.type';
import { TtPersistenceRequestOption } from './tt-persistence-request-option.enum';
import { TtPersistenceRouteFilter } from './tt-persistence-route-filter.interface';

/**
 * GET method options:
 *
 * - `storeName`: Override the default storeName set in the RouteMap.
 *
 * - `format`: Boolean toggle whether the results should use a formatter
 * function from the {@see TtPersistenceConfig}, or the formatter function
 * defined in this object.
 *
 * - `skip`: Skip this route, without having to change the route path or
 * removing the route or method altogether.
 *
 * - `formatter?`: Formatter function that allows the transformation of the data
 * before it is sent back to the interceptor. Overrides the one in the module
 * config.
 *
 * - `params`: Map with http parameter string values and their corresponding
 * enum type value. These are used to handle pagination and sorting and the
 * like. These values are not unique to the route, so they can be defined once
 * and reused for other routes.
 *
 * - `filter`: If the objectStore is shared, or if the request narrows the
 * content by the values defined in the route (i.e. a UUID that limits the
 * scope), the filter can be defined either by the
 * {@see TtPersistenceRouteFilter} or adding a function via the
 * {@see TtPersistenceRouteFilterFunction}.
 *
 * - `trigger`: Using the name of a {@see PersistenceIndexTrigger}, use an
 * index trigger to limit the initial data retrieval to specific parts of the
 * url and/or http parameters. Can be multiple triggers, but make sure to add
 * a `unique` flag to at least one rule in each trigger.
 *
 * - `joiner`: Join data from one or more objectStores, according to the
 * {@see TtPersistenceJoiner} interface.
 */
export interface TtPersistenceRouteGet {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Skip this method for the route.
  skip?: boolean;
  // Whether formatting is enabled or not for this route.
  format?: boolean;
  // Custom formatter. If not set, will fall back to the config formatter.
  formatter?: TtPersistenceFormatter;
  // A Map with HttpParams and the corresponding RequestOptions.
  params?: Map<string, TtPersistenceRequestOption>;
  // Custom filter function, or reference to UUID in route.
  filter?: TtPersistenceRouteFilterFunction | TtPersistenceRouteFilter;
  // Trigger name(s), set in the PersistenceOptions for the objectStore.
  trigger?: string | string[];
  // Join data from one or more objectStores.
  joiner?: TtPersistenceJoiner[];
}
