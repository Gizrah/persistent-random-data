import { HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, OperatorFunction, throwError } from 'rxjs';
import { filter, map, mergeMap, switchMap } from 'rxjs/operators';
import { NoPrimaryKeyInObjectError } from './errors/no-primary-key-in-object.error';
import { NoPrimaryKeyInSettingsError } from './errors/no-primary-key-in-settings.error';
import { IndexedDBStoreError } from './errors/indexeddb-store.error';
import { TriggerNotFoundError } from './errors/trigger-not-found.error';
import { Extractor } from './extractor.class';
import { Generator } from './generator.class';
import { TtDeleteCascade } from './interfaces/tt-delete-cascade.enum';
import { TtPersistenceDeleteResult } from './interfaces/tt-persistence-delete-result.interface';
import { TtPersistenceIndexTriggerParam } from './interfaces/tt-persistence-index-trigger.interface';
import {
  PersistenceIndexTriggerRule,
  PersistenceOptionsTrigger,
} from './interfaces/persistence-options-trigger.interface';
import {
  RetrieveByKeyOptions,
  RetrieveByPageOptions,
  RetrieveBySearchOptions,
  RetrieveBySortingOptions,
} from './interfaces/retrieve-options.interface';
import { Generatable, Unknown, QueueMap } from './interfaces/shared.type';
import { TtPersistenceOptions } from './interfaces/tt-persistence-options.interface';
import { TtPersistenceResult } from './interfaces/tt-persistence-result.interface';
import { TtPersistenceDatabaseService } from './services/tt-persistence-database.service';
import { TtPersistenceDeleteService } from './services/tt-persistence-delete.service';
import { TtPersistenceRetrieveService } from './services/tt-persistence-retrieve.service';
import { TtPersistenceStoreService } from './services/tt-persistence-store.service';
import { asArray } from './functions/as-array.function';

type OperatorTT<T> = OperatorFunction<T | T[], T | T[]>;

//noinspection JSMethodCanBeStatic
/**
 * This service is used to create persistent storage of offline data, which can
 * be randomly generated using the Extractor and/or Generator classes.
 */
@Injectable({
  providedIn: 'root',
})
export class TtPersistenceService {

  /**
   * Extractor class instance, to extract and generate randomized data that will
   * be stored persistently.
   */
  public readonly extractor: Extractor;

  /**
   * Generator class instance to generate the content with. Pass-through from
   * the Extractor class instance.
   */
  public readonly generator: Generator;

  constructor(
    private databaseService: TtPersistenceDatabaseService,
    private storeService: TtPersistenceStoreService,
    private retrieveService: TtPersistenceRetrieveService,
    private deleteService: TtPersistenceDeleteService,
  ) {
    this.extractor = new Extractor();
    this.generator = this.extractor.generator;
  }

  /**
   * Get the total results for the last GET action done to the given objectStore
   * name. Returns 0 if nothing is found.
   */
  public getCounter(storeName: string): number {
    return this.databaseService.getCounter(storeName);
  }

  /**
   * Get only the UUID part from any string, or the original string if no UUID
   * is found. Supply an index parameter if there are multiple UUIDs possible.
   */
  public uuidFrom(value: string, index?: number): string {
    return this.databaseService.extractPrimaryKey(value, index);
  }

  /**
   * Create RetrieveByKeyOptions for the given nested property and the primary
   * key or keys. The property will be converted to an index that matches the
   * (UUID extracted) primary key(s).
   */
  public retrieveByKey(property: string | null, primaryKeys: string | string[]): RetrieveByKeyOptions {
    return {
      index: property ? `${property}.${this.databaseService.idKey}` : this.databaseService.idKey,
      primaryKeys: Array.isArray(primaryKeys)
        ? primaryKeys.map((item) => this.databaseService.extractUuid(item))
        : this.databaseService.extractUuid(primaryKeys),
    };
  }

  /**
   * With the given content, create a persistent objectStore and indices for the
   * object and its keys/values. An array of items will be reduced to a single
   * set of keys that will decide the indices of the objectStore. The indices
   * are only made for non-object, non-array and non-boolean properties of the
   * content to persist, since IndexedDB can't index these types of values.
   */
  public persist(content: unknown, options: TtPersistenceOptions): Observable<TtPersistenceResult[]> {
    const contents: Unknown[] = asArray(content) as Unknown[];
    return new Observable<[QueueMap, Map<string, string[]>]>((subscriber) => {
      // Update the PersistenceSettings with the new options.
      this.databaseService.updatePersistenceSettings(options);
      // Parse the content for any (nested) links set in the options.
      // This will add or update existing storage and persistence settings.
      let linkedItems: Map<string, Unknown[]> = new Map();
      linkedItems = this.storeService.parseContentForLinking(options.storeName, contents, linkedItems);
      // Update the localStorage database settings and get the added indices.
      const indexMap: Map<string, string[]> = this.databaseService.updateStorageSettings(linkedItems);
      subscriber.next([linkedItems, indexMap]);
    }).pipe(
      switchMap(([queueMap, indexMap]) => this.databaseService.initializeDatabase(queueMap, indexMap)),
      switchMap(([queueMap, indexMap, database]) => {
        const results: TtPersistenceResult[]
          = this.createPersistenceResultsMap(queueMap, indexMap, options.storeContent);

        if (options.storeContent !== false) {
          return this.storeService.insertLinkedItemsInStores(database, queueMap)
            .pipe(map(() => results));
        }

        return of(results);
      }),
    );
  }

  /**
   * Add new content to the database. Optionally, generate values that need to
   * be randomized using Generatable model classes, for instance when adding new
   * content that does not yet have a UUID value.
   */
  public post<T>(storeName: string, content: T | T[], generate?: Generatable): Observable<T | T[]> {
    const contents: Unknown[] = asArray(content) as Unknown[];
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((database) => this.getPrimaryKeyForStore(database as IDBDatabase, storeName)),
      switchMap(([database, idKey]) => {
        const options: TtPersistenceOptions | undefined = this.databaseService.optionsMap.get(storeName);
        if (!options) {
          return throwError(() => new NoPrimaryKeyInSettingsError(storeName));
        }
        const extended: Unknown[] = contents.map((item) => this.createItemWithIdKeyValue(
          storeName,
          idKey,
          item as Unknown,
          generate,
        ));
        const queueMap: QueueMap = this.storeService.createQueueMap(options, extended);
        return this.storeService.updateContentInStore(database, storeName, queueMap);
      }),
      switchMap(([database, gpsIds]) => this.retrieveService.getContentById(database, storeName, gpsIds)),
      map((posted) => this.databaseService.removeGeneratedIdKeyFromContent(posted) as T | T[]),
    );
  }

  /**
   * Update existing content in the database's objectStore with the given name.
   * The options for this objectStore should already be known and set using an
   * earlier persist action, otherwise some errors may be directed at the user.
   *
   * Note: if this is objectStore is linked in many other objectStores, an
   * overflow error can occur. In that case limit the size of the content.
   */
  public put<T>(storeName: string, content: T | T[]): Observable<T | T[]> {
    const contents: Unknown[] = asArray(content) as Unknown[];
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((database) => {
        const options: TtPersistenceOptions | undefined = this.databaseService.optionsMap.get(storeName);
        if (!options) {
          return throwError(() => new NoPrimaryKeyInSettingsError(storeName));
        }
        const queueMap: QueueMap = this.storeService.createQueueMap(options, contents);
        return this.storeService.updateContentInStore(database as IDBDatabase, storeName, queueMap);
      }),
      switchMap(([database, gpsIds]) => this.retrieveService.getContentById(database, storeName, gpsIds)),
      map((updated) => this.databaseService.removeGeneratedIdKeyFromContent(updated) as T[]),
      map((cleaned: T[]) => (cleaned.length === 1 ? cleaned[0] : cleaned)),
    );
  }

  /**
   * Retrieve one or more rows from the specific objectStore, with the given
   * primaryKey(s) or pagination options. Sorting can be applied to paginated
   * results.
   * If the GET request only has a single primary key, the returned result will
   * be a single object. In all other instances, the returned result will be
   * an array of objects.
   */
  public get<T>(
    storeName: string,
    getOptions: RetrieveByKeyOptions | RetrieveByPageOptions,
    sortOptions?: RetrieveBySortingOptions,
  ): Observable<T | T[]> {
    this.databaseService.setCounter(storeName, 0);
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((idbDatabase) => {
        const database: IDBDatabase = idbDatabase as IDBDatabase;
        if ('primaryKeys' in getOptions) {
          const keys: string[] = asArray(getOptions.primaryKeys);
          return this.retrieveService.getContentById(database, storeName, keys, getOptions);
        }

        return this.retrieveService.getContentByStore(database, storeName).pipe(
          map((content) => this.retrieveService.sortContent(storeName, content, sortOptions)),
          map((content) => this.retrieveService.paginateContent(content, getOptions)),
        );
      }),
      map((retrieved) => this.databaseService.removeGeneratedIdKeyFromContent(retrieved as Unknown[]) as T | T[]),
      map((cleaned) => {
        if ('primaryKeys' in getOptions && typeof getOptions.primaryKeys === 'string') {
          return Array.isArray(cleaned) ? cleaned[0] : cleaned;
        }
        return cleaned;
      }),
    );
  }

  /**
   * Retrieve data from an objectStore according to a specific Persistence
   * Trigger. All (paginated and/or sorted) results are returned based on the
   * trigger content. {@see PersistenceIndexTrigger}.
   */
  public trigger<T>(
    storeName: string,
    triggerName: string,
    request: HttpRequest<T>,
    sortOptions?: RetrieveBySortingOptions,
    pageOptions?: RetrieveByPageOptions,
  ): Observable<T[]> {
    this.databaseService.setCounter(storeName, 0);
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((idbDatabase) => {
        const database: IDBDatabase = idbDatabase as IDBDatabase;
        const trigger: PersistenceOptionsTrigger = this.databaseService.triggerMap.get(storeName)?.get(triggerName);
        if (!trigger) {
          return throwError(() => new TriggerNotFoundError(storeName, triggerName));
        }
        return this.chainTriggerContent(database, storeName, trigger, request, sortOptions, pageOptions);
      }),
      map((retrieved) => this.databaseService.removeGeneratedIdKeyFromContent(retrieved as Unknown[]) as T[]),
    );
  }

  /**
   * Delete given keys from the named objectStore, or if an error occurs, return
   * that. If cascading type is defined, the linked objectStores will be pruned.
   */
  public delete(
    storeName: string,
    primaryKeys: string | string[],
  ): Observable<TtPersistenceDeleteResult[]> {
    const keys: string[] = asArray(primaryKeys);
    const extracted: string[] = keys.map((key) => this.databaseService.extractUuid(key));
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((database) => this.deleteService.deleteContentFromStore(
        database as IDBDatabase,
        storeName,
        extracted,
      )),
    );
  }

  /**
   * Search for a value in a specific index. An index is available for each of
   * the (nested) properties that have a string or number value. Indices are
   * created with dot notation for object keys (e.g. `main.nested.value`).
   * Boolean and array values are excluded. For more advanced searches or
   * matches, use the {@see TtPersistenceService.filter} function.
   */
  public search<T>(
    storeName: string,
    searchOptions: RetrieveBySearchOptions,
    pageOptions?: RetrieveByPageOptions,
    sortOptions?: RetrieveBySortingOptions,
  ): Observable<T[]> {
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((idbDatabase) => {
        const database: IDBDatabase = idbDatabase as IDBDatabase;
        return this.retrieveService.getSortedContent<T>(database, storeName, sortOptions).pipe(
          map((content) => this.retrieveService.matchSearchTermToContent(
            content,
            searchOptions,
            pageOptions,
          )),
        ) as Observable<T[]>;
      }),
      map((retrieved) => this.databaseService.removeGeneratedIdKeyFromContent(retrieved as Unknown[]) as T[]),
    );
  }

  /**
   * Find one or more specific items in the objectStore using the given callback
   * function. Results can be sorted and/or paginated if the options are given.
   */
  public filter<T>(
    storeName: string,
    callback: (result: T, request?: HttpRequest<T>) => boolean,
    httpRequest?: HttpRequest<T>,
    pageOptions?: RetrieveByPageOptions,
    sortOptions?: RetrieveBySortingOptions,
  ): Observable<T[]> {
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((idbDatabase) => {
        const database: IDBDatabase = idbDatabase as IDBDatabase;
        return this.retrieveService.getSortedContent(database, storeName, sortOptions as RetrieveBySortingOptions).pipe(
          map((content) => this.retrieveService.matchCallbackToContent(
            content as T[],
            callback,
            httpRequest,
            pageOptions,
          ) as T[]),
        );
      }),
      map((retrieved) => this.databaseService.removeGeneratedIdKeyFromContent(retrieved as Unknown[]) as T[]),
    );
  }

  /**
   * Find a specific item in the given objectStore using a callback function.
   */
  public find<T>(
    storeName: string,
    callback: (result: T, request?: HttpRequest<T>) => boolean,
    httpRequest?: HttpRequest<T>,
  ): Observable<T> {
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((database) => this.retrieveService.getSortedContent(database as IDBDatabase, storeName)),
      map((content) => content.find((item: T) => callback(item, httpRequest)) as T),
      map((retrieved) => this.databaseService.removeGeneratedIdKeyFromContent(retrieved as Unknown) as T),
    );
  }

  /**
   * Remove all content from an objectStore, but keep the objectStore and the
   * in-memory and localStorage data and settings for it.
   */
  public clear(storeName: string): Observable<boolean> {
    return this.databaseService.database$.pipe(
      filter((database) => (!!database)),
      switchMap((database) => new Observable<boolean>(subscriber => {
        database = database as IDBDatabase;
        if (!database.objectStoreNames.contains(storeName)) {
          subscriber.next(true);
        }

        const transaction: IDBTransaction = database.transaction(storeName, 'readwrite');
        const store: IDBObjectStore = transaction.objectStore(storeName);
        const request: IDBRequest = store.clear();
        request.onerror = (event: Event): void => {
          const target: IDBRequest = event.target as IDBRequest;
          subscriber.error(new IndexedDBStoreError(target?.error?.message as never));
        };
        request.onsuccess = (): void => {
          subscriber.next(true);
        };
      })),
    );
  }

  /**
   * Delete an objectStore from the Persistence database and keep, remove or
   * overwrite the data in the objectStores that referenced the deleted data
   * according to the DeleteCascadeOptions. Returns an array of results with
   * the affected objectStores and rows, including the paths inside each of the
   * objects where the nested data was found.
   */
  public deleteObjectStore(
    storeName: string | string[],
    type: TtDeleteCascade,
  ): Observable<TtPersistenceDeleteResult[]> {
    return this.deleteService.deleteObjectStore(storeName, type);
  }

  /**
   * Completely remove the database and its content, the settings and options
   * previously defined in other persist actions that are stored in the
   * localStorage, and clean-up all in-memory content, links and settings.
   */
  public deleteDatabase(): Observable<void> {
    return this.databaseService.deleteDatabase();
  }

  /**
   * Check the existence of an IdKey for the currently opened store. If no IdKey
   * is present, the content can't be stored or updated, since no primary key
   * can be found and/or generated. This check is only relevant for changing
   * data and is ignored when retrieving data.
   */
  private getPrimaryKeyForStore(database: IDBDatabase, storeName: string): Observable<[IDBDatabase, string]> {
    return new Observable((subscriber) => {
      const options: TtPersistenceOptions | undefined = this.databaseService.optionsMap.get(storeName);
      if (options === undefined) {
        // If the primaryKey value isn't found, there can be no mapping to the
        // primary key, so abort the whole action and throw an error.
        subscriber.error(new NoPrimaryKeyInSettingsError(storeName));
        return;
      }

      subscriber.next([database, options.primaryKey]);
    });
  }

  /**
   * Convert the QueueMap and index map to an array of PersistenceResults, which
   * is the summary of the persist action.
   */
  private createPersistenceResultsMap(
    queueMap: QueueMap,
    indexMap: Map<string, string[]>,
    store?: boolean,
  ): TtPersistenceResult[] {
    const results: Map<string, TtPersistenceResult> = new Map();
    for (const [storeName, queue] of queueMap) {
      results.set(storeName, {
        storeName: storeName,
        rows: !!store ? queue.length : 0,
        indices: indexMap.get(storeName) ?? [],
      });
    }
    return [...results.values()];
  }

  /**
   * Add the primary key to the given object for the current objectStore, using
   * the Generatable if supplied. Linked content is directly cleaned out before
   * returning the actual to-be-stored object.
   */
  private createItemWithIdKeyValue(storeName: string, idKey: string, item: Unknown, generate?: Generatable): Unknown {
    const generated: Record<string, unknown> = generate ? this.generator.generate(generate, true) : {};
    const combined: Unknown = { ...item, ...generated };
    const idValue: string = this.getPrimaryKeyValue(combined, storeName, idKey);
    return { [this.databaseService.idKey]: idValue, ...combined };
  }

  /**
   * Get the primary key value from the given item, or throw a tantrum if the
   * value doesn't exist. The content is parsed for a UUID initially, but can
   * be any unique value.
   */
  private getPrimaryKeyValue(item: Unknown, storeName: string, primaryKey: string): string {
    const idValue: string = this.databaseService.extractUuid(item[primaryKey] as string);
    if (!idValue) {
      throw new NoPrimaryKeyInObjectError(storeName, primaryKey);
    }
    return idValue;
  }

  /**
   * By checking if there's a possibility of a parameter with multiple values,
   * create a chain of retrieval combinations based on the variations of all
   * possible values (i.e. indices in the objectStore) and return the
   * concatenated results.
   */
  //eslint-disable-next-line max-lines-per-function
  private chainTriggerContent<T>(
    database: IDBDatabase,
    storeName: string,
    trigger: PersistenceOptionsTrigger,
    request: HttpRequest<T>,
    sortOptions?: RetrieveBySortingOptions,
    pageOptions?: RetrieveByPageOptions,
  ): Observable<T[]> {
    const multiple: boolean = trigger.rules.some((rule) => ('params' in rule && !!rule.params));
    const search: boolean = trigger.rules.some((item) => ('search' in item && item.search === true));
    const method: string = search ? 'searchContentByTrigger' : 'getContentByTrigger';

    if (!multiple) {
      const [start, end] = this.getValuesForTrigger(request, trigger.rules);
      return this.retrieveService[method](database, storeName, trigger, start, end, sortOptions, pageOptions);
    }

    const combinations: [string[], string[]][] = this.createRuleCombinations(trigger.rules, request);
    const noDoubles: [string[], string[]][] = this.pruneRuleCombinations(combinations);
    const triggers$: Observable<T[]>[] = [];
    for (const values of noDoubles) {
      const [start, end] = values;
      triggers$.push(this.retrieveService[method](database, storeName, trigger, start, end, sortOptions, pageOptions));
    }
    const first: Observable<T[]> = triggers$[0];
    const rest: Observable<T[]>[] = triggers$.slice(1);
    const mergeMaps: OperatorTT<T>[] = rest.map((observable) => mergeMap((allResults: T[]) => {
      return observable.pipe(map((results) => allResults.concat(results)));
    }));

    if (!first) {
      const [start, end] = this.getValuesForTrigger(request, trigger.rules);
      return this.retrieveService[method](database, storeName, trigger, start, end, sortOptions, pageOptions);
    }

    return first.pipe.call(first, ...mergeMaps);
  }

  /**
   * Loop through an array of rules and, using the already set values, create
   * new combination chains for each rule that has multiple parameter values.
   */
  private createRuleCombinations<T>(
    rules: PersistenceIndexTriggerRule[],
    request: HttpRequest<T>,
    baseValues: [string[], string[]] = [[], []],
    combinations: [string[], string[]][] = [],
  ): [string[], string[]][] {
    const [start, end] = baseValues;

    for (const rule of rules) {
      if (!('params' in rule)) {
        const values: [string, string] = this.getValueForRule(request, rule);
        start.push(values[0]);
        end.push(values[1]);
        continue;
      }

      const idx: number = rules.indexOf(rule);
      const sliced: PersistenceIndexTriggerRule[] = rules.slice(idx + 1);
      const base: [string[], string[]] = [start, end];
      combinations = combinations.concat(this.createRuleValueCombinations(rule, sliced, request, base));
    }

    if (!rules.some((rule) => ('params' in rule && !!rule.params))) {
      // If no multiple param values are found, no combinations are added either
      // so at least create the basic combination of all values.
      combinations.push([start, end]);
    }

    return combinations;
  }

  /**
   * Prune doubles from the various combinations, since the fallback to make
   * sure that any value is added also adds doubles, unfortunately.
   */
  private pruneRuleCombinations(combinations: [string[], string[]][]): [string[], string[]][] {
    const cleaned: [string[], string[]][] = [];

    for (const [start, end] of combinations) {
      const found: boolean = cleaned.some(([cleanedStart, cleanedEnd]) => {
        return start.every((value, index) => cleanedStart[index] === value)
          && end.every((value, index) => cleanedEnd[index] === value);
      });

      if (!found) {
        cleaned.push([start, end]);
      }
    }

    return cleaned;
  }

  /**
   * Looping through the values of a parameter with multiple values, the rules
   * that succeed it are used to create additional combinations. This method
   * calls back to the {@see createRuleCombinations} method, so additional rules
   * that have multiple values are handled recursively as well.
   */
  private createRuleValueCombinations<T>(
    rule: TtPersistenceIndexTriggerParam,
    rules: PersistenceIndexTriggerRule[],
    request: HttpRequest<T>,
    baseValue: [string[], string[]],
  ): [string[], string[]][] {
    const values: string[] = request.params.getAll(rule.params) ?? [];
    const [start, end] = baseValue;
    let combinations: [string[], string[]][] = [];

    for (const value of values) {
      const base: [string[], string[]] = [[...start, value], [...end, value]];
      combinations = combinations.concat(this.createRuleCombinations(rules, request, base, combinations));
    }

    return combinations;
  }

  /**
   * Parse the trigger and get the values from the url or HttpParams and return
   * the values as an array that is used as the IDBKeyRange binding.
   */
  private getValuesForTrigger<T>(request: HttpRequest<T>, rules: PersistenceIndexTriggerRule[]): [string[], string[]] {
    const start: string[] = [];
    const end: string[] = [];

    for (const rule of rules) {
      const values: [string, string] = this.getValueForRule(request, rule);
      start.push(values[0]);
      end.push(values[1]);
    }

    return [start, end];
  }

  /**
   * Get the actual value for the rule.
   */
  private getValueForRule<T>(request: HttpRequest<T>, rule: PersistenceIndexTriggerRule): [string, string] {
    if (!('param' in rule)) {
      const atIndex: string = this.databaseService.extractPrimaryKey(request.url, rule.index, true);
      return [atIndex, atIndex];
    }

    const fromParam: string[] = request.params.getAll(rule.params) ?? [request.params.get(rule.param)] ?? [];
    const value: string = fromParam[rule.index ?? 0] ?? '';
    const parsed: string = rule.primaryKey ? this.databaseService.extractPrimaryKey(value) : value;

    if (!('search' in rule) || rule.search !== true || !rule.searchIn?.length) {
      return [parsed, parsed];
    }

    return [parsed.toUpperCase(), parsed.toLowerCase() + 'z'];
  }
}
