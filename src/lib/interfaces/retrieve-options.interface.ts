/**
 * Sorting options for retrieving the data.
 *
 * - `column`: The property or dot-notated path to the property to sort the data
 * on. This property must be a (nested) object and not an array. Values can be
 * any string or number.
 *
 * - `direction`: Sorting direction. Ascending or descending.
 */
export interface RetrieveBySortingOptions {
  // Which (dot-notated) column to sort the data on.
  column: string;
  // Sorting direction.
  direction: 'asc' | 'desc';
}

/**
 * Get one or more items by their primary key from a certain objectStore.
 *
 * - `primaryKeys`: One or more primary key values to match.
 *
 * - `index`: The index name used in the object store which should be used to
 * match the primary keys, instead of the objectStore's own primary key. Note
 * that indices are made when the data is persisted and are only made for nested
 * objects, not for arrays or boolean values. Indices can be accessed via dot
 * notation (i.e. `my.nested.index.name`).
 */
export interface RetrieveByKeyOptions {
  // One or more primary key or index values to retrieve.
  primaryKeys: string | string[];
  // The index name used in the objectStore instead of the primary key column.
  index?: string;
}

/**
 * Get a paginated amount of items from a certain objectStore. These options
 * can complement search term results.
 *
 * - `page`: The page number.
 *
 * - `pageSize`: The amount of results per page.
 *
 * - `pagination`: If false, returns all data from the objectStore at once. It
 * is ignored if page and/or pageSize are set.
 */
export interface RetrieveByPageOptions {
  // Page number.
  page: number;
  // Amount of items per page.
  pageSize: number;
  // Whether pagination is enabled at all, even if page/pageSize are set.
  pagination?: boolean;
}

/**
 * Get one or more items by matching the search term to a specific objectStore
 * index name. Note that since it is an object-based storage, searching can only
 * be done on nested objects, not arrays. Use a filter function to search in
 * nested arrays for matches.
 *
 * - `term`: The string search value.
 *
 * - `index`: The objectStore index, that is, a property name or
 * dot-notated path to a property name (i.e. `my.nested.property`) where the
 * term should be matched.
 *
 * - `limit`: Limit the amount of search results to the given number. Limiting
 * the search results only works if no pagination options are given.
 */
export interface RetrieveBySearchOptions {
  // The search string.
  term: string;
  // The path in the item or index in the objectStore to search in.
  index: string;
  // Limit the amount of results if no pagination options are present.
  limit?: number;
}
