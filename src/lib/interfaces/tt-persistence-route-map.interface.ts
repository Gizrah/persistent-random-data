import { TtPersistenceRouteDelete } from './tt-persistence-route-delete.interface';
import { TtPersistenceRouteGet } from './tt-persistence-route-get.interface';
import { TtPersistenceRoutePost } from './tt-persistence-route-post.interface';
import { TtPersistenceRoutePut } from './tt-persistence-route-put.interface';

/**
 * Route mapping options for the TtPersistence services.
 *
 * - `url`: The specific request url. This can be added as-is as a full url, but
 * for legibility it's recommended that the UUIDs are replaced with `{{uuid}}`.
 * Prefixes like 'https://' can be discarded as well.
 *
 * - `storeName`: The objectStore name where the data can be found. This does not
 * have to be a unique objectStore, but make sure to add a filtering mechanism
 * if that is the case.
 *
 * - `skip`: Skip this route, without having to change the route path or
 * removing the route or method altogether.
 *
 * - `get`: GET method options, {@see TtPersistenceRouteGet}. Can be undefined, or
 * and empty object. As long as the property exists, it counts.
 *
 * - `post`: POST method options, {@see TtPersistenceRoutePost}. Can be undefined,
 * or and empty object. As long as the property exists, it counts.
 *
 * - `put`: PUT and PATCH method options, {@see TtPersistenceRoutePut}. Can be
 * undefined, or and empty object. As long as the property exists, it counts.
 *
 * - `delete`: DELETE method options, {@see TtPersistenceRouteDelete}. Can be
 * undefined, or and empty object. As long as the property exists, it counts.
 */
export interface TtPersistenceRouteMap {
  // The url for this mapping.
  url: string;
  // The objectStore name the data should be retrieved from.
  storeName: string;
  // Skip this entire path and all its methods.
  skip?: boolean;
  // GET method options.
  get?: TtPersistenceRouteGet;
  // POST method options.
  post?: TtPersistenceRoutePost;
  // PUT method options.
  put?: TtPersistenceRoutePut;
  // PATCH method options (i.e. PUT).
  patch?: TtPersistenceRoutePut;
  // DELETE method options.
  delete?: TtPersistenceRouteDelete;
}
