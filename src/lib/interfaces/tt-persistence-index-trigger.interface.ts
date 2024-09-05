/**
 * Persistence Index Trigger allows the user to add custom indices to an
 * objectStore that will be matched when certain criteria are met. These allow
 * for much faster bulk data retrieval. Create a trigger by combining one or
 * multiple types of triggers (UUID-based or HttpParam-based). These are
 * combined to create unique, custom indices.
 *
 * There are two types of rules: by UUID from the url and by htt parameter.
 * Both share some similarities, but the rules are applied differently.
 *
 * ----
 *
 * ### PersistenceIndexTriggerUuid
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
 * ----
 *
 * ### PersistenceIndexTriggerParam
 * - `property`: Which nested property, using dot-notation, the parameter is
 * referencing. If the parameter links to a primary key that uses characters
 * that can't be used as the index, set `primaryKey` to true and only use the
 * property name of the object (e.g. `my.nested.@id` won't work, so use
 * `my.nested` and set `primaryKey: true`).
 *
 * - `primaryKey`: Appends the default value (`__pkey__`) for the primary key to
 * the `property` value, so it can reference the object via its primary key.
 * Default is false.
 *
 * - `unique`: If there are multiple triggers on a {@see TtPersistenceRouteMap}
 * definition on a single method, setting one or more rules as unique can make
 * it easier to narrow the matching scope to determine which trigger should be
 * used when the call is made.
 *
 * - `param`: The actual http parameter to get the value from.
 *
 * - `params`: If the http parameter is an array-type, the first value will be
 * returned (for now).
 *
 * - `index`: If the parameter is an array, instead of the first value, the
 * value at this index (if defined) should be used instead. Defaults to the
 * first value if nothing is found at the index, or returns an empty string if
 * no values are found.
 *
 * ----
 * Example for both in a single ruleset:
 * @example ```
 * {
 *    name: 'PersonInLocationByType',
 *    rules: [
 *      // The first UUID in the url will match the nested `location` property's
 *      // primary key as stored in the objectStore.
 *      {
 *        property: 'location',
 *        index: 0,
 *        primaryKey: true,
 *      },
 *      // The parameter/property `type` will be matched next. If multiple types
 *      // are present, the first type will be used. This HttpParam is unique.
 *      {
 *        property: 'type',
 *        param: 'type',
 *        params: 'type[]',
 *        index: 0,
 *        unique: true,
 *      }
 *    ]
 *  }
 * ```
 */
export interface TtPersistenceIndexTrigger {
  // The name of this trigger, as used in the RouteMaps.
  name: string;
  // The set of rules for this trigger.
  rules: (TtPersistenceIndexTriggerUuid | TtPersistenceIndexTriggerParam)[];
}

/**
 * Shared properties for the triggers. Check their documentation.
 */
interface PersistenceIndexTriggerBase {
  // Which (dot-notated) property the UUID or HttpParam references.
  property: string;
  // If the property value references an object, setting primaryKey to true will
  // reference and match the primary key in the object to the primary key column
  // in the objectStore.
  primaryKey?: boolean;
}

/**
 * Persistence Index Trigger that looks at a specific UUID in the url.
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
 */
export interface TtPersistenceIndexTriggerUuid extends PersistenceIndexTriggerBase {
  // Which array-like index the UUID occupies in the url.
  index: number;
}

/**
 * Persistence Index Trigger that looks at a specific http parameters.
 *
 * - `property`: Which nested property, using dot-notation, the parameter is
 * referencing. If the parameter links to a primary key that uses characters
 * that can't be used as the index, set `primaryKey` to true and only use the
 * property name of the object (e.g. `my.nested.@id` won't work, so use
 * `my.nested` and set `primaryKey: true`).
 *
 * - `primaryKey`: Appends the default value (`__pkey__`) for the primary key to
 * the `property` value, so it can reference the object via its primary key.
 * Default is false.
 *
 * - `unique`: If there are multiple triggers on a {@see TtPersistenceRouteMap}
 * definition on a single method, setting one or more rules as unique can make
 * it easier to narrow the matching scope to determine which trigger should be
 * used when the call is made.
 *
 * - `param`: The actual http parameter to get the value from.
 *
 * - `params`: If the http parameter is an array-type, the first value will be
 * returned.
 *
 * - `index`: If the parameter is an array, instead of the first value, the
 * value at this index (if defined) should be used instead. Defaults to the
 * first value if nothing is found at the index, or returns an empty string if
 * no values are found. If multiple values are present in the params, the
 * service will attempt to create indices for all values and retrieve them
 * sequentially.
 *
 * - `search`: If set to true, the content of `property` will be used to match
 * the search terms. If the search term match should be applied to more than
 * one property, use `properties`.
 *
 * - `searchIn`: An array of (dot-notated) keys that refer directly to fields
 * that can be searched. These searches are done by referencing the objectStore
 * indices. Use the {@see TtTriggerSearchProperty} with a (dot-notated) property
 * value to indicate that a search function should be used on the content,
 * instead of referencing the indices of the objectStore. This is notably
 * slower, but allows for matching of arrays, since those are not indexed by
 * IndexedDB.
 */
export interface TtPersistenceIndexTriggerParam extends PersistenceIndexTriggerBase {
  // If multiple triggers exist on a single method in one endpoint, making a
  // rule unique will help with precise matching.
  unique?: boolean;
  // HttpParam key to get the value from.
  param: string;
  // Array-type HttpParam key to get multiple values from.
  params?: string;
  // If the `params` value is set, use this index (get all values by default).
  index?: number;
  // If the param value should be used to search.
  search?: boolean;
  // Which objectStore indices or specific properties to search in.
  searchIn?: (string | TtTriggerSearchProperty)[];
}

/**
 * Define a property to apply a search function to, instead of using the
 * objectStore indices.
 */
export interface TtTriggerSearchProperty {
  property: string;
}
