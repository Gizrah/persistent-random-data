import { HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { IndexedDBStoreError } from '../errors/indexeddb-store.error';
import { asArray } from '../functions/as-array.function';
import { doLog, log, logEnd, logStart } from '../functions/log.function';
import { PersistenceOptionsTrigger } from '../interfaces/persistence-options-trigger.interface';
import { TtPersistenceOptions } from '../interfaces/tt-persistence-options.interface';
import {
  RetrieveByKeyOptions,
  RetrieveByPageOptions,
  RetrieveBySearchOptions,
  RetrieveBySortingOptions,
} from '../interfaces/retrieve-options.interface';
import { TtFilterCallback, OperatorUnknown, Unknown } from '../interfaces/shared.type';
import { TtPersistenceDatabaseService } from './tt-persistence-database.service';

/**
 * The RetrieveService handles all GeneratorPersistence actions that pertain to
 * retrieving data from the various objectStores. The returned content has the
 * internal id and storeNames for nested content removed before the data is
 * returned.
 */
@Injectable()
export class TtPersistenceRetrieveService {

  constructor(private databaseService: TtPersistenceDatabaseService) {}

  /**
   * Private shorthand getter for the debug state.
   */
  private get debug(): boolean {
    return this.databaseService.debug;
  }

  /**
   * Return the list of items from the objectStore with the given idKeys, using
   * a mergeMap to wait for completion for each of the steps and joining the
   * results in a single array of objects.
   */
  public getContentById(
    database: IDBDatabase,
    storeName: string,
    gpsIds: string[],
    options?: RetrieveByKeyOptions,
  ): Observable<Unknown[]> {
    doLog(this.debug, logStart, 'getContentById');
    doLog(this.debug, log, 'STORENAME:', storeName);
    doLog(this.debug, log, 'IDS:', gpsIds);
    doLog(this.debug, log, 'KEY OPTIONS:', options);
    const first: string = gpsIds[0];
    const rest: string[] = gpsIds.slice(1);

    const operators: OperatorUnknown[] = rest
      .map((idKey) => mergeMap((previous: Unknown[]) => this.createResultObservable(
        database,
        storeName,
        idKey,
        options?.index,
      ).pipe(
        map((result) => [...previous, ...asArray<Unknown>(result)]),
      )));
    const firstResult: Observable<Unknown[]> = this.createResultObservable(
      database,
      storeName,
      first,
      options?.index,
    ).pipe(
      map((result) => asArray<Unknown>(result)),
    );
    doLog(this.debug, logEnd);
    //@ts-ignore
    return firstResult.pipe.call(firstResult, ...operators) as Observable<Unknown[]>;
  }

  /**
   * Return all the rows from a given objectStore. This method should be used in
   * conjunction with filtering and/or pagination to prevent a data-dump in the
   * application.
   */
  public getContentByStore(database: IDBDatabase, storeName: string): Observable<Unknown[]> {
    doLog(this.debug, logStart, 'getContentByStore');
    doLog(this.debug, log, 'STORENAME:', storeName);
    return new Observable<Unknown[]>(subscriber => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readonly');
      const store: IDBObjectStore = transaction.objectStore(storeName);

      const request: IDBRequest = store.getAll();
      request.onerror = (): void => subscriber.error(new IndexedDBStoreError(storeName));
      request.onsuccess = (): void => {
        doLog(this.debug, log, 'RESULT', request.result);
        doLog(this.debug, logEnd);
        subscriber.next(request.result as Unknown[]);
      };
    });
  }

  /**
   * Return all content from the given storeName sorted and/or paginated, based
   * on the trigger and the range of values for the trigger's index.
   */
  //eslint-disable-next-line max-lines-per-function
  public getContentByTrigger(
    database: IDBDatabase,
    storeName: string,
    trigger: PersistenceOptionsTrigger,
    rangeStart: string[],
    rangeEnd?: string[],
    sortOptions?: RetrieveBySortingOptions,
    pageOptions?: RetrieveByPageOptions,
  ): Observable<Unknown[]> {
    doLog(this.debug, logStart, 'getContentByTrigger');
    doLog(this.debug, log, 'STORENAME:', storeName);
    doLog(this.debug, log, 'TRIGGER:', trigger);
    doLog(this.debug, log, 'RANGESTART/END:', rangeStart, rangeEnd);
    doLog(this.debug, log, 'SORT/PAGE OPTIONS:', sortOptions, pageOptions);
    return new Observable<Unknown[]>((subscriber) => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readonly');
      transaction.onerror = (event): void => {
        doLog(this.debug, logEnd, 'ERROR ENCOUNTERED:', event);
        subscriber.error(new IndexedDBStoreError(storeName));
      };
      const start: string | string[] = rangeStart.length === 1 ? rangeStart[0] : rangeStart;
      rangeEnd = rangeEnd ?? rangeStart;
      const end: string | string[] = Array.isArray(start) ? rangeEnd : rangeEnd[0];
      const store: IDBObjectStore = transaction.objectStore(storeName);
      const keyRange: IDBKeyRange = IDBKeyRange.bound(start, end);
      const request: IDBRequest = store.index(trigger.index).getAll(keyRange);

      request.onerror = (event): void => {
        doLog(this.debug, logEnd, 'ERROR ENCOUNTERED:', event);
        subscriber.error(new IndexedDBStoreError(storeName));
      };

      request.onsuccess = (event: Event): void => {
        const target: IDBRequest = event.target as IDBRequest;
        const result: Unknown[] = target.result as Unknown[];
        doLog(this.debug, log, 'EVENT:', event);
        doLog(this.debug, logEnd, 'RESULTS:', result);
        subscriber.next(result);
      };
    }).pipe(
      map((results) => this.sortContent(storeName, results, sortOptions)),
      map((results) => this.paginateContent(results, pageOptions)),
    );
  }

  /**
   * By using the same mechanics as a regular OptionsTrigger, search for content
   * by chaining various {@see getContentByTrigger} actions, based on the index
   * values in the searchIn array of the OptionsTrigger.
   */
  //eslint-disable-next-line max-lines-per-function
  public searchContentByTrigger<T>(
    database: IDBDatabase,
    storeName: string,
    trigger: PersistenceOptionsTrigger,
    start: string[],
    end: string[],
    sortOptions?: RetrieveBySortingOptions,
    pageOptions?: RetrieveByPageOptions,
  ): Observable<Unknown[]> {
    const traversals: string[][] = this.createTraversalList(trigger);
    if (!traversals.length) {
      return of([]);
    }
    const newTrigger: PersistenceOptionsTrigger = {
      ...trigger,
      index: trigger.searchIn[0][0],
      keyPath: trigger.searchIn[0][1],
    };
    const range: string[] = start.slice(0, trigger.searchIn[0][1].length);
    const searchIndex: number = this.getIndexOfSearchValue(trigger);
    if (searchIndex === undefined) {
      return of([]);
    }
    return this.getContentByTrigger(database, storeName, newTrigger, range, range).pipe(
      map((results: Unknown[]) => results.filter((item) => {
        for (const traverse of traversals) {
          if (this.traverseItemPath(item, traverse, start[searchIndex].toLowerCase())) {
            return true;
          }
        }
        return false;
      })),
      map((results: Unknown[]) => this.sortContent(storeName, results, sortOptions)),
      map((results: Unknown[]) => this.paginateContent(results, pageOptions)),
    );
  }

  /**
   * Return all content from the objectStore in a neat, sorted manner.
   */
  public getSortedContent<T>(
    database: IDBDatabase,
    storeName: string,
    options?: RetrieveBySortingOptions,
  ): Observable<T[]> {
    return this.getContentByStore(database, storeName).pipe(
      map((content) => this.sortContent(storeName, content as T[], options)),
    );
  }

  /**
   * Search through the entire content of an objectStore and return the items
   * that match the search criteria. This method should only be used in
   * conjunction with {@see getContentByStore} or {@see getSortedContent} return
   * values.
   */
  public matchSearchTermToContent<T>(
    content: T[],
    searchOptions: RetrieveBySearchOptions,
    pageOptions?: RetrieveByPageOptions,
  ): T[] {
    const path: string[] = searchOptions.index.split('.');
    const matched: T[] = content.filter((item) => this.traverseItemPath(
      item as Unknown,
      path,
      searchOptions.term,
    ));

    return this.paginateContent(matched, pageOptions);
  }

  /**
   * Using the callback, filter items in the content list, which should be from
   * either {@see getContentByStore} or {@see getSortedContent} methods.
   */
  public matchCallbackToContent<T>(
    content: T[],
    callback: TtFilterCallback<T>,
    request?: HttpRequest<T>,
    pageOptions?: RetrieveByPageOptions,
  ): T[] {
    const filtered: T[] = content.filter((item) => callback(item, request)) as T[];
    return this.paginateContent(filtered, pageOptions);
  }

  /**
   * Apply pagination to the results of either {@see getContentByStore} or
   * {@see getSortedContent} methods or derivatives.
   */
  public paginateContent<T>(content: T[], options?: RetrieveByPageOptions): T[] {
    doLog(this.debug, logStart, 'PAGINATING CONTENT');
    const start: number = options ? (options.page - 1) * options.pageSize : -1;
    const end: number = options ? start + options.pageSize : 0;

    if (options?.pagination === false) {
      doLog(this.debug, logEnd, 'PAGINATION DISABLED FOR ROUTE');
      return content;
    }

    doLog(this.debug, log, 'PAGE START, PAGE END:', start, end);
    if (start >= 0) {
      if (content.length <= options.pageSize) {
        doLog(this.debug, log, `CONTENT LENGTH (${content.length}) <= PAGE SIZE (${options.pageSize})`);
        doLog(this.debug, logEnd, 'RETURNING ALL CONTENT');
        return content;
      }
      doLog(this.debug, logEnd, 'SLICING CONTENT');
      return content.slice(start, end);
    }

    return content;
  }

  /**
   * Sort the given content according to the SortingOptions.
   */
  public sortContent<T>(storeName: string, content: T[], options?: RetrieveBySortingOptions): T[] {
    this.databaseService.setCounter(storeName, content.length);
    if (!options?.column) {
      return content as T[];
    }

    const column: string[] = options.column.split('.');

    return content.sort((a: T, b: T) => this.compare(
      this.getComparisonValue(a as Unknown, column) as string | number,
      this.getComparisonValue(b as Unknown, column) as string | number,
      options.direction === 'asc',
    )) as T[];
  }

  /**
   * Get the content for the given idKey and push the results through the
   * stream, or throw an error.
   */
  private createResultObservable(
    database: IDBDatabase,
    storeName: string,
    primaryKey: string,
    index?: string,
  ): Observable<Unknown> {
    return new Observable<Unknown | undefined>((subscriber) => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readonly');
      const store: IDBObjectStore = transaction.objectStore(storeName);
      let request: IDBRequest;
      if (!index) {
        request = store.get(primaryKey);
      } else {
        const keyRange: IDBKeyRange = IDBKeyRange.bound(primaryKey, primaryKey);
        request = store.index(index).getAll(keyRange);
      }

      request.onerror = (): void => {
        subscriber.error(request.error?.message);
      };

      request.onsuccess = (): void => {
        const result: Unknown = request.result as Unknown;
        const keys: string[] = Object.keys(result);
        subscriber.next(!!keys.length ? result : undefined);
      };
    }).pipe(
      switchMap((result) => this.createLinkedResultObservable(database, storeName, result)),
    );
  }

  /**
   * Create result observable that contains linked content for the given result
   * by getting the linked options from the linkMap for this storeName and
   * creating a chain of operators that themselves check for linked results
   * recursively.
   */
  private createLinkedResultObservable(
    database: IDBDatabase,
    storeName: string,
    result: Unknown | undefined,
  ): Observable<Unknown> {
    const linkMap: Map<string, string> = this.databaseService.linkMap.get(storeName) ?? new Map();
    const result$: Observable<Unknown> = of(result) as Observable<Unknown>;
    if (!linkMap.size || result === undefined) {
      return result$;
    }
    const operators: OperatorUnknown[] = [];
    for (const [property, store] of linkMap) {
      const options: TtPersistenceOptions = this.databaseService.optionsMap.get(store) as TtPersistenceOptions;
      if (!result.hasOwnProperty(property) || typeof result[property] !== 'object') {
        continue;
      }
      const linkedObject: Unknown | Unknown[] = result[property] as Unknown | Unknown[];
      if (Array.isArray(linkedObject)) {
        linkedObject.filter((linked) => typeof linked[this.databaseService.idKey] === 'string').map((linked) => {
          const gpsId: string = linked[this.databaseService.idKey] as string;
          operators.push(this.createLinkedResultOperator(database, options.storeName, property, gpsId, true));
        });
        continue;
      }
      const gpsId: string = linkedObject[this.databaseService.idKey] as string;
      if (!gpsId) {
        continue;
      }
      operators.push(this.createLinkedResultOperator(database, options.storeName, property, gpsId));
    }
    //@ts-ignore
    return result$.pipe.call(result$, ...operators) as Observable<Unknown>;
  }

  /**
   * Create a mergeMap Operator function that combines the related database
   * result(s) to the right property of the current object.
   */
  private createLinkedResultOperator(
    database: IDBDatabase,
    storeName: string,
    property: string,
    gpsId: string,
    array?: boolean,
  ): OperatorUnknown {
    return mergeMap((current) => this.createResultObservable(database, storeName, gpsId).pipe(
      map((linked) => {
        if (array) {
          // Have to ignore the implicit any error here, since it is an unknown
          // object key that is being referenced. So it's explicit any.
          //@ts-ignore
          current[property] = [...(current[property] as Unknown[] ?? []), linked];
          return current;
        }
        //@ts-ignore
        current[property] = linked;
        return current;
      }),
    ));
  }

  /**
   * Recursively parse an item by traversing the given path array, containing
   * a chain of properties leading to the nested item that has to be checked for
   * a matching search term.
   */
  private traverseItemPath(item: Unknown, path: string[], term: string): boolean {
    if (!path.length || !item.hasOwnProperty(path[0])) {
      return false;
    }

    if (path.length > 1 && typeof item[path[0]] === 'object') {
      if (!Array.isArray(item[path[0]])) {
        return this.traverseItemPath(item[path[0]] as Unknown, path.slice(1), term);
      }
      for (const nested of item[path[0]] as Unknown[]) {
        const match: boolean = this.traverseItemPath(nested as Unknown, path.slice(1), term);
        if (match) {
          return true;
        }
      }
    }

    if (path.length === 1) {
      return this.checkResultForSearchTerm(item[path[0]], term);
    }

    return false;
  }

  /**
   * Compare the given result and object properties to see if any of the given
   * properties have a matching value for the searchTerm.
   */
  private checkResultForSearchTerm(result: unknown, searchTerm: string): boolean {
    const lowerCase: string = String(searchTerm).toLowerCase();
    const value: string = String(result);
    return typeof value !== 'object' && value.toLowerCase().includes(lowerCase);
  }

  /**
   * Travel the item according to the path and return the first value. Used to
   * sort content.
   */
  private getComparisonValue(item: Unknown, path: string[]): unknown {
    if (!path.length || !item.hasOwnProperty(path[0])) {
      return item;
    }

    if (path.length > 1 && typeof item[path[0]] === 'object') {
      if (!Array.isArray(item[path[0]])) {
        return this.getComparisonValue(item[path[0]] as Unknown, path.slice(1));
      }
      for (const nested of item[path[0]] as Unknown[]) {
        const match: unknown = this.getComparisonValue(nested as Unknown, path.slice(1));
        if (match) {
          return match;
        }
      }
    }

    if (path.length === 1) {
      return item[path[0]];
    }

    return item;
  }

  /**
   * Convert the Trigger searchIn paths that contain an object instead of a
   * string value to an array of strings, which will be used to traverse the
   * various result paths, similarly to how a normal search action would.
   */
  private createTraversalList(trigger: PersistenceOptionsTrigger): string[][] {
    return trigger.rules.reduce((keys, rule) => {
      if (!('search' in rule) || !rule.search || !rule.searchIn?.length) {
        return keys;
      }
      //const properties: string[] = rule.searchIn.filter((search) => (typeof search === 'object'))
      //  .map((item: TriggerSearchProperty) => item.property);
      const properties: string[][] = rule.searchIn.map((item) => {
        if (typeof item === 'string') {
          return item.split('.');
        }
        return item.property.split('.');
      });
      return keys.concat(properties);
    }, []);
  }

  /**
   * Get the index of the rule that has the search flag set to true, so the
   * value can be retrieved from the range of values.
   */
  private getIndexOfSearchValue(trigger: PersistenceOptionsTrigger): number | undefined {
    let searchIndex: number;
    for (const rule of trigger.rules) {
      if (searchIndex !== undefined) {
        break;
      }
      if ('search' in rule && rule.search) {
        searchIndex = trigger.rules.indexOf(rule);
      }
    }

    return searchIndex;
  }

  /**
   * Comparator function for sorting.
   */
  private compare(a: number | string, b: number | string, ascending: boolean): number {
    return (a < b ? -1 : 1) * (ascending ? 1 : -1);
  }
}
