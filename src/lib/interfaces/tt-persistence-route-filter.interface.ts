/**
 * Filter options for the TtPersistenceRouteMap. Allows matching a different
 * UUID from the url via the uuidIndex value, or matching the UUID to a nested
 * property index or primary key.
 *
 * @example ```
 *  // Url value matches an objectStore index value:
 *  // url: location.com/user/some@email.com
 *  {
 *    property: person.primaryEmailAddress.value
 *    matcher: (url: string): string => {
 *      return url.replace('location.com/user/', '');
  *   }
 *  }
 *  // Url value matches aUUID:
 *  // url: location.com/user/123456-asfdasf-123-123-sadf/photo/asdfasdfasd-sadf
 *  {
 *    index: 1,
 *  }
 * ```
 *
 * - `property`: Which nested property, using dot-notation, the UUID is the
 * index value for. If the nested UUID links to a primary key that uses
 * characters that can't be used as the index, set `primaryKey` to true and only
 * use the property name of the object (e.g. `my.nested.@id` won't work, so use
 * `my.nested` and set `primaryKey: true`).
 *
 * - `primaryKey`: Appends the default value (`__pkey__`) for the primary key to
 * the `property` value, so it can reference the object via its primary key.
 * Default is false.
 *
 * - `index`: The place of the UUID in the url, starting at 0.
 *
 * - `matcher`: Function to extract certain values from the url, if they are not
 * default UUID values. The full url is given as a parameter. If no value is
 * returned, an error will be thrown.
 */
export interface TtPersistenceRouteFilter {
  // Key (or dot.noted.path) of which property matches the UUID in the url.
  property?: string;
  // If the property value references an object, setting primaryKey to true will
  // reference and match the primary key in the object to the primary key column
  // in the objectStore.
  primaryKey?: boolean;
  // Which index should be used instead of the default 0.
  index?: number;
  // Function to extract the required index value.
  matcher?: (url: string) => string;
}
