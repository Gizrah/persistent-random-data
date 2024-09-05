import { Injectable } from '@angular/core';
import { Observable, of, OperatorFunction } from 'rxjs';
import { filter, map, mergeMap, switchMap } from 'rxjs/operators';
import { IndexedDBDeleteError } from '../errors/indexeddb-delete.error';
import { IndexedDBStoreError } from '../errors/indexeddb-store.error';
import { asArray } from '../functions/as-array.function';
import { TtDeleteCascade } from '../interfaces/tt-delete-cascade.enum';
import { TtPersistenceDeleteResult } from '../interfaces/tt-persistence-delete-result.interface';
import { ParentLink } from '../interfaces/parent-link.interface';
import { PersistenceIndexCleanup } from '../interfaces/persistence-index-cleanup.interface';
import { TtPersistenceOptions } from '../interfaces/tt-persistence-options.interface';
import { PersistenceSettings } from '../interfaces/persistence-settings.interface';
import { LinkMap, OptionsMap, QueueMap, StorageMap, Unknown } from '../interfaces/shared.type';
import { TtPersistenceDatabaseService } from './tt-persistence-database.service';
import { TtPersistenceStoreService } from './tt-persistence-store.service';

// Internal abbreviated types.
type CombinedResult = [QueueMap, TtPersistenceDeleteResult[]];
type CombinedUnset = (QueueMap | TtPersistenceDeleteResult[]);

// Internal interface extending the ParentLink for path traversal.
interface ParentDelete extends ParentLink {
  path: string[];
}

// Internal type similar to the ParentLinkMap.
type ParentDeleteMap = Map<string, ParentDelete>;

/**
 * The DeleteService handles all actions surrounding the deletion of content. It
 * works slightly less straight-forward than one would expect, since there can
 * be a lot of linked data between various objectStores. As such, it checks the
 * links between child content and parent content, in order to update the data
 * according to the cascading rules set in each of the objectStores definitions,
 * as defined by the {@see TtPersistenceOptions}.
 *
 * Effectively, that means that when an object is deleted, it will go through
 * the linked objectStores and the nested paths (for parent objects containing
 * the now-deleted child object), updates the data according to the cascade
 * options, and reinserts the object in the objectStore again. For linked
 * content nested in the new-deleted object, they will be kept or deleted
 * according to the cascade options.
 */
@Injectable()
export class TtPersistenceDeleteService {

  constructor(
    private databaseService: TtPersistenceDatabaseService,
    private storeService: TtPersistenceStoreService,
  ) {}

  /**
   * Private shorthand getter for the debug state.
   */
  private get debug(): boolean {
    return this.databaseService.debug;
  }

  /**
   * Delete all keys from the objectStore, or if an error occurs, return a
   * specific error. If cascading type is defined, the linked objectStores will
   * be pruned similarly to the deleteObjectStore action.
   */
  public deleteContentFromStore(
    database: IDBDatabase,
    storeName: string,
    idKeys: string[],
  ): Observable<TtPersistenceDeleteResult[]> {
    return new Observable<TtPersistenceDeleteResult>((subscriber) => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readwrite');
      const store: IDBObjectStore = transaction.objectStore(storeName);
      const deleteResult: TtPersistenceDeleteResult = {
        storeName: storeName,
        primaryKeys: [],
        path: '',
        type: TtDeleteCascade.DELETE,
      };
      for (const key of idKeys) {
        const request: IDBRequest = store.delete(key);
        request.onerror = (event: Event): void => {
          event.preventDefault();
          event.stopPropagation();
          const target: IDBRequest = event.target as IDBRequest;
          subscriber.error(new IndexedDBDeleteError(storeName, key, target.error));
        };

        request.onsuccess = (): void => {
          deleteResult.primaryKeys.push(key);
          if (idKeys.indexOf(key) === idKeys.length - 1) {
            subscriber.next(deleteResult);
          }
        };
      }
    }).pipe(
      switchMap((result) => this.checkAndPruneParents(database, storeName, idKeys, undefined, result)),
    );
  }

  /**
   * Delete the objectStore with the given name, if found. If cascade is set to
   * true, all linked parent items will have the property with the content that
   * links to the objectStore removed.
   */
  public deleteObjectStore(
    storeName: string | string[],
    type: TtDeleteCascade,
  ): Observable<TtPersistenceDeleteResult[]> {
    const storeNames: string[] = asArray(storeName);
    const deleteMap: ParentDeleteMap = new Map();
    for (const name of storeNames) {
      for (const [store, link] of this.createParentDeleteMap(name)) {
        deleteMap.set(store, link);
      }
      this.prunePersistenceSettings(name, deleteMap);
    }

    if (type === TtDeleteCascade.KEEP) {
      const result: TtPersistenceDeleteResult[] = storeNames.map((name) => ({
        storeName: name,
        primaryKeys: [],
        path: '',
        type: type,
      } as TtPersistenceDeleteResult));
      return this.databaseService.initializeDatabase(new Map(), new Map()).pipe(map(() => result));
    }

    return this.databaseService.initializeDatabase(new Map(), new Map()).pipe(
      switchMap(() => this.databaseService.database$),
      filter((database) => !!database),
      switchMap((database) => this.checkAndPruneParents(database, undefined, undefined, deleteMap)),
    );
  }

  /**
   * Add the paths to each ParentDelete item, by getting the parent, if found,
   * and joining the current ParentDelete item's path to the parent item's
   * property value.
   */
  private createParentDeleteMap(storeName: string): ParentDeleteMap {
    const parentMap: ParentDeleteMap = this.storeService.createParentLinkMap(storeName) as ParentDeleteMap;
    for (const [store, link] of parentMap) {
      const parent: ParentDelete | undefined = parentMap.get(link.parentStoreName as string);
      if (!parent) {
        continue;
      }

      link.path = link.path ?? [link.property];
      parent.path = [parent.property, ...link.path];
      parentMap.set(store, link);
      parentMap.set(parent.storeName, parent);
    }

    return parentMap;
  }

  /**
   * Check if there are parents to prune, or return the optional result if set.
   */
  private checkAndPruneParents(
    database: IDBDatabase,
    storeName: string,
    idKeys: string[],
    deleteMap?: ParentDeleteMap,
    result?: TtPersistenceDeleteResult,
  ): Observable<TtPersistenceDeleteResult[]> {
    deleteMap = deleteMap ?? this.createParentDeleteMap(storeName);
    if (deleteMap.size) {
      return this.createPruningOperators(database, deleteMap, idKeys).pipe(
        mergeMap(([queueMap, deleteResults]) =>
          this.storeService.insertLinkedItemsInStores(database, queueMap).pipe(
            map(() => deleteResults),
          )),
      );
    }
    return of(result ? [result] : []);
  }

  /**
   * Clean-up all PersistenceSettings and related PersistenceOptions by
   * scrubbing all mentions of the given storeName.
   */
  private prunePersistenceSettings(storeName: string, deleteMap: ParentDeleteMap): void {
    let settings: PersistenceSettings = this.databaseService.settings;
    const storageMap: StorageMap = this.databaseService.storageMap;
    const linkMap: LinkMap = this.pruneLinkMap(storeName);
    const optionsMap: OptionsMap = this.pruneOptionsMap(storeName);

    storageMap.set(storeName, new Map());
    this.databaseService.storageMap = storageMap;

    const mutationSet: Set<string> = new Set([...settings.mutations.remove ?? []]);
    mutationSet.add(storeName);
    settings.mutations.remove = [...mutationSet.keys()];
    settings.version = settings.version + 1;

    settings = this.createIndexMutations(settings, deleteMap);
    settings.links = this.databaseService.convertLinkMapToSettingsLink(linkMap);
    settings.options = [...optionsMap.entries()];
    this.databaseService.settings = settings;
    this.databaseService.linkMap = linkMap;
    this.databaseService.optionsMap = optionsMap;
  }

  /**
   * Remove all links to the given storeName from the in-memory LinkMap in the
   * DatabaseService.
   */
  private pruneLinkMap(storeName: string): LinkMap {
    const linkMap: LinkMap = this.databaseService.linkMap;
    linkMap.delete(storeName);

    for (const [store, stringMap] of linkMap) {
      for (const [property, linkedStore] of stringMap) {
        if (linkedStore === storeName) {
          stringMap.delete(property);
          linkMap.set(store, stringMap);
        }
      }
    }

    return linkMap;
  }

  /**
   * Prune the in-memory OptionsMap, holding the PersistenceOptions for each of
   * the objectStores. The to-be-deleted objectStore is first removed. If the
   * user has just performed a persist action, the in-memory OptionsMap still
   * holds the linkedKeys map, with the links to other objectStores for one or
   * more properties. These are scrubbed recursively for references to the
   * given storeName.
   */
  private pruneOptionsMap(storeName: string): OptionsMap {
    const optionsMap: OptionsMap = new Map([...this.databaseService.optionsMap.entries()]);
    optionsMap.delete(storeName);

    for (const [store, options] of optionsMap) {
      if (!options.linkedKeys) {
        continue;
      }

      for (let [property, linkOptions] of options.linkedKeys) {
        linkOptions = this.pruneLinkedKeys(storeName, linkOptions);
        options.linkedKeys.set(property, linkOptions);
      }

      optionsMap.set(store, options);
    }

    return optionsMap;
  }

  /**
   * Recursively scrub the (nested) linkedKeys in the given PersistenceOptions
   * for the given storeName.
   */
  private pruneLinkedKeys(storeName: string, options: TtPersistenceOptions): TtPersistenceOptions {
    if (!options.linkedKeys) {
      return options;
    }

    for (let [property, linkOptions] of options.linkedKeys) {
      if (linkOptions.storeName === storeName) {
        options.linkedKeys.delete(property);
        continue;
      }

      if (linkOptions.linkedKeys) {
        linkOptions = this.pruneLinkedKeys(storeName, linkOptions);
        options.linkedKeys.set(property, linkOptions);
      }

    }

    return options;
  }

  /**
   * Create and fill the indices in the PersistenceSettings' mutations with the
   * joined path available in the ParentDelete items and return the settings
   * object.
   */
  private createIndexMutations(settings: PersistenceSettings, deleteMap: ParentDeleteMap): PersistenceSettings {
    for (const [storeName, link] of deleteMap) {
      const cleanup: PersistenceIndexCleanup = {
        storeName: storeName,
        indices: [],
      };
      if (!link.path) {
        continue;
      }

      const path: string = link.path.join('.');

      const indexMap: Map<string, boolean> | undefined = this.databaseService.storageMap.get(storeName);
      if (!indexMap) {
        continue;
      }

      for (const index of indexMap.keys()) {
        if (index.indexOf(path) > -1) {
          cleanup.indices.push(index);
        }
      }
      settings.mutations.indices.push(cleanup);
    }
    return settings;
  }

  /**
   * Using the ParentDeleteMap, this function creates an observable that chains
   * pruning observables that remove or overwrite the nested link to the deleted
   * objectStore, returning a combined result containing the QueueMap with the
   * data that has to be overwritten in each objectStore, as well as an array of
   * DeleteResults that show the detailed results of each delete action.
   */
  private createPruningOperators(
    database: IDBDatabase,
    deleteMap: ParentDeleteMap,
    primaryKeys?: string[],
    type?: TtDeleteCascade,
  ): Observable<CombinedResult> {
    const parents: ParentDelete[] = [...deleteMap.values()];
    const first: ParentDelete = parents[0];
    const rest: ParentDelete[] = parents.slice(1);
    const operators: OperatorFunction<CombinedResult, CombinedUnset[]>[] = rest.map((link) =>
      mergeMap((combined: CombinedResult) => this.createPruningObservable(database, link, primaryKeys, type).pipe(
        map((deleteResult) => {
          const queueMap: QueueMap = combined[0];
          const results: TtPersistenceDeleteResult[] = combined[1];
          const resultSet: Set<Unknown> = deleteResult.content as Set<Unknown>;
          queueMap.set(link.storeName, [...(resultSet).values()]);
          delete deleteResult.content;
          results.push(deleteResult);
          return [queueMap, results];
        }),
      )));
    const firstPrune: Observable<CombinedResult> = this.createPruningObservable(database, first, primaryKeys, type)
      .pipe(
        map((deleteResult) => {
          const resultSet: Set<Unknown> = deleteResult.content as Set<Unknown>;
          const queueMap: QueueMap = new Map([[first.storeName, [...resultSet.values()]]]);
          delete deleteResult.content;
          return [queueMap, [deleteResult]] as CombinedResult;
        }),
      );
    //@ts-ignore
    return firstPrune.pipe.call(firstPrune, ...operators);
  }

  /**
   * Returns an observable with a DeleteResult object, containing the affected
   * rows and some more information, as well as the updated content. The updated
   * content has been pruned of the nested content that has been removed from
   * the database. If an array of primary keys have been supplied, only the
   * content which have the nested removed content with the matching primary key
   * will be affected.
   */
  private createPruningObservable(
    database: IDBDatabase,
    link: ParentDelete,
    primaryKeys?: string[],
    type?: TtDeleteCascade,
  ): Observable<TtPersistenceDeleteResult> {
    const options: TtPersistenceOptions = this.databaseService.optionsMap.get(link.storeName);
    type = type ?? options.cascade ?? TtDeleteCascade.KEEP;
    return this.getCursorForStore(database, link.storeName).pipe(
      switchMap((request) => new Observable<TtPersistenceDeleteResult>((subscriber) => {
        const deleteResult: TtPersistenceDeleteResult = {
          storeName: link.storeName,
          primaryKeys: [],
          path: (link.path as string[]).join('.'),
          type: type,
        };
        deleteResult.content = new Set();
        request.onsuccess = (event: Event): void => {
          const target: IDBRequest = event.target as IDBRequest;
          const cursor: IDBCursorWithValue = target.result as IDBCursorWithValue;
          if (!cursor) {
            subscriber.next(deleteResult);
            return;
          }
          if (!primaryKeys) {
            this.handlePruneAll(link, type, deleteResult, cursor);
          } else {
            this.handlePruneById(link, type, deleteResult, cursor, primaryKeys);
          }
        };
      })),
    );
  }

  /**
   * Get a cursor for the given objectStore and return the cursor via the
   * stream, so it can be used to traverse the objectStore.
   */
  private getCursorForStore(
    database: IDBDatabase,
    storeName: string,
    index?: string,
    direction?: IDBCursorDirection,
  ): Observable<IDBRequest> {
    return new Observable<IDBRequest>((subscriber) => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readonly');
      const store: IDBObjectStore | IDBIndex = index
        ? transaction.objectStore(storeName).index(index)
        : transaction.objectStore(storeName);

      transaction.onerror = (): void => {
        subscriber.error(new IndexedDBStoreError(storeName));
      };

      const request: IDBRequest = store.openCursor(undefined, direction);
      request.onerror = (): void => subscriber.error(new IndexedDBStoreError(storeName));
      subscriber.next(request);
    });
  }

  /**
   * Handle the pruning of all nested content that was present in the deleted
   * objectStore and update the DeleteResult.
   */
  private handlePruneAll(
    link: ParentDelete,
    type: TtDeleteCascade,
    deleteResult: TtPersistenceDeleteResult,
    cursor: IDBCursorWithValue,
  ): void {
    const linkPath: string[] = link.path as string[];
    const item: Unknown = cursor.value as Unknown;
    const primaryKey: string = item[this.databaseService.idKey] as string;
    this.traverseItemPath(item, linkPath, type);
    (deleteResult.content as Set<Unknown>).add(item);
    deleteResult.primaryKeys.push(primaryKey);
    cursor.continue();
  }

  /**
   * Handle the pruning of all nested content which matches the array of primary
   * keys. Only affected rows update the DeleteResult.
   */
  private handlePruneById(
    link: ParentDelete,
    type: TtDeleteCascade,
    deleteResult: TtPersistenceDeleteResult,
    cursor: IDBCursorWithValue,
    primaryKeys: string[],
  ): void {
    const linkPath: string[] = link.path as string[];
    const item: Unknown = cursor.value as Unknown;
    const primaryKey: string = item[this.databaseService.idKey] as string;
    const removed: boolean = this.traverseItemPathForId(item, linkPath, type, primaryKeys);
    if (removed) {
      (deleteResult.content as Set<Unknown>).add(item);
      deleteResult.primaryKeys.push(primaryKey);
    }
    cursor.continue();
  }

  /**
   * Recursively parse an item by traversing the given path array, containing
   * a chain of properties leading to the nested item that needs to be removed
   * or overwritten according to the type.
   */
  private traverseItemPath(item: Unknown, path: string[], type: TtDeleteCascade): void {
    if (!path.length || !item.hasOwnProperty(path[0])) {
      return;
    }

    if (path.length > 1 && typeof item[path[0]] === 'object') {
      if (!Array.isArray(item[path[0]])) {
        this.traverseItemPath(item[path[0]] as Unknown, path.slice(1), type);
        return;
      }
      for (const nested of item[path[0]] as Unknown[]) {
        this.traverseItemPath(nested as Unknown, path.slice(1), type);
      }
    }

    if (path.length === 1) {
      this.handleCascade(item, path[0], type);
    }
  }

  /**
   * Similar to {@see traverseItemPath}, but with a list of primary keys that is
   * supplied to determine which nested item that matches the delete-list should
   * be removed. Since nested items that match the primary keys can be part of
   * an array, there's some more logic to determine match cases.
   */
  //eslint-disable-next-line complexity
  private traverseItemPathForId(
    item: Unknown,
    path: string[],
    type: TtDeleteCascade,
    primaryKeys: string[],
  ): boolean {
    if (!path.length || !item.hasOwnProperty(path[0])) {
      return false;
    }
    let adjusted: boolean = false;
    if (path.length > 1 && typeof item[path[0]] === 'object') {
      if (!Array.isArray(item[path[0]])) {
        return this.traverseItemPathForId(item[path[0]] as Unknown, path.slice(1), type, primaryKeys);
      }
      for (const nested of item[path[0]] as Unknown[]) {
        const changed: boolean = this.traverseItemPathForId(nested as Unknown, path.slice(1), type, primaryKeys);
        adjusted = adjusted || changed;
      }
    }
    if (path.length === 1) {
      if (!Array.isArray(item[path[0]])) {
        return this.checkItemRemovalState(item, primaryKeys, path[0]) ? this.handleCascade(item, path[0], type) : false;
      }
      for (const nested of item[path[0]] as Unknown[]) {
        if (!this.checkItemRemovalState(nested, primaryKeys)) {
          continue;
        }
        const changed: boolean = this.traverseItemPathForId(nested, path.slice(1), type, primaryKeys);
        adjusted = adjusted || changed;
      }
    }
    return adjusted;
  }

  /**
   * Simple check to see if the nested content's idKey matches one of the keys
   * in the primaryKeys array. If so, the item should be removed.
   */
  private checkItemRemovalState(item: Unknown, primaryKeys: string[], property?: string): boolean {
    const nested: Unknown = property ? item[property] as Unknown : item;
    if (!nested) {
      return false;
    }
    const idValue: string = nested[this.databaseService.idKey] as string;
    return primaryKeys.includes(idValue);
  }

  /**
   * Remove of overwrite the property in the item according to the type.
   */
  private handleCascade(item: Unknown, property: string, type: TtDeleteCascade): boolean {
    switch (type) {
      case TtDeleteCascade.DELETE:
        delete item[property];
        break;
      case TtDeleteCascade.NULL:
        item[property] = null;
        break;
      case TtDeleteCascade.UNDEFINED:
        item[property] = undefined;
        break;
    }

    return true;
  }
}
