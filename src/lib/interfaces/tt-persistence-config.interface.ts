import { Injector } from '@angular/core';
import { Extractor } from '../extractor.class';
import { Generator } from '../generator.class';
import { TtPersistenceService } from '../tt-persistence.service';
import { TtPersistenceRouteMap } from './tt-persistence-route-map.interface';
import { TtPersistenceFormatter } from './shared.type';

/**
 * Configuration for the TtPersistenceModule.
 *
 * - `enabled`: Set the default state of using the interceptor to use the
 * randomized/generated data from the IndexedDB.
 *
 * - `mapping`: A list of route definitions containing the url, the objectStore
 * name for that route, whether to add formatting to the response, a custom
 * formatter if the general formatter isn't suitable, a map with the HttpParams
 * mapping for pagination and sorting and filtering options if so desired.
 *
 * - `seeder`: Optional function that will be called on first time service
 * construction.
 *
 * - `authenticator`: Optional async function that is called on first time
 * service construction. If defined, will set the `auth` flag to true. This
 * toggle can be used in any route guard's `canActivate` function, by checking
 * the {@see TtPersistenceStateService.authenticated} value. This value is tied
 * to the persistence state as well, so if it is disabled, the skip is ignored.
 *
 * - `formatter`: If any of the RouteMaps have the `format` boolean toggle set
 * to true but have no custom formatter, this default formatter is called before
 * the data is sent to the interceptor. This allows for the data to be molded
 * according to some application-wide logic, like the usage of SEO wrappers.
 *
 * - `debug`: Log many parts of the journey when retrieving data from the
 * indexedDB.
 *
 * - `debugSplitUrlOn`: Debugging logs the urls which are intercepted by the
 * interceptor in the console groups. To prevent massive urls from being shown,
 * the url can be split on a certain part. The second part (index 1) will be
 * displayed.
 */
export interface TtPersistenceConfig {
  // If set to true, will set the interceptor to true.
  enabled: boolean;
  // Mapping of routes to objectStores with specifications for each route.
  mapping: TtPersistenceRouteMap[];
  // Seeder function which populates the IndexedDB.
  seeder?: (persistence: TtPersistenceService, extractor: Extractor, generator: Generator) => Promise<void>;
  // Authenticator function that sets the fake authentication details.
  authenticator?: (injector: Injector) => Promise<void>;
  // General formatter function that is used by each mapped route that should be
  // formatted and has no custom formatter.
  formatter?: TtPersistenceFormatter;
  // Debug, logs all kinds of things to the console.
  debug?: boolean;
  // If debug is enabled, split the urls on what part so logging doesn't get
  // too clogged?
  debugSplitUrlOn?: string;
}
