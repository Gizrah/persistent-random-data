/**
 * Various options to determine the type of HttpParam and the required actions.
 *
 * `PAGE`: Pagination page number.
 * `PAGE_SIZE`: Pagination page size, i.e. results per page.
 * `PAGINATION`: Boolean toggle to enable/disable pagination and return all data
 * instead of page-sized.
 * `SORTING`: Generic sorting parameter.
 * `SORT_COLUMN`: Specific column to sort all data on (before pagination).
 * `SORT_COLUMN_IN_PARAM`: Sort column is found noted in brackets in the
 * parameter value. Will join multiple brackets as a property path.
 * `SORT_ASC`: Sort order ascending for `SORTING` and `SORT_COLUMN` params.
 * `SORT_DESC`: Sort order descending for `SORTING` and `SORT_COLUMN` params.
 * `SEARCH_TERM`: Parameter containing search term value.
 * `SEARCH_INDEX`: Parameter containing the path/property to match search to.
 */
export enum TtPersistenceRequestOption {
  PAGE = 'PAGE',
  PAGE_SIZE = 'PAGE_SIZE',
  PAGINATION = 'PAGINATION',
  SORTING = 'SORTING',
  SORT_COLUMN = 'SORT_COLUM',
  SORT_COLUMN_IN_PARAM = 'SORT_COLUMN_IN_PARAM',
  SORT_ASC = 'SORT_ASC',
  SORT_DESC = 'SORT_DESC',
  SEARCH_TERM = 'SEARCH_TERM',
  SEARCH_INDEX = 'SEARCH_INDEX',
}
