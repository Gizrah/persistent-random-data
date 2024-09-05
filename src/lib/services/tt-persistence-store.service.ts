import { Injectable } from '@angular/core';
import { Observable, of, OperatorFunction } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { IndexedDBAddError } from '../errors/indexeddb-add.error';
import { IndexedDBStoreError } from '../errors/indexeddb-store.error';
import { asArray } from '../functions/as-array.function';
import { ParentLink } from '../interfaces/parent-link.interface';
import { TtPersistenceOptions } from '../interfaces/tt-persistence-options.interface';
import { LinkMap, OptionsMap, QueueMap, StringMap, Unknown, ParentLinkMap } from '../interfaces/shared.type';
import { TtPersistenceDatabaseService } from './tt-persistence-database.service';


type AddedMap = Map<string, Map<string, Unknown>>;

/**
 * The StoreService handles all GeneratorPersistence actions that pertain to the
 * inserting of data into the database. The content is parsed for all linked
 * data as known in the PersistenceSettings and per-store PersistenceOptions,
 * before separating the (nested) content per-store and creating an observable
 * queue that handles the bulk insertion.
 */
@Injectable()
export class TtPersistenceStoreService {

  constructor(private databaseService: TtPersistenceDatabaseService) {}

  /**
   * Private shorthand getter for the debug state.
   */
  private get debug(): boolean {
    return this.databaseService.debug;
  }

  /**
   * Update the objectStore records with the supplied edited content. All errors
   * are aggregated and returned on error. Completed transactions are not rolled
   * back.
   */
  public updateContentInStore(
    database: IDBDatabase,
    storeName: string,
    queueMap: QueueMap,
  ): Observable<[IDBDatabase, string[]]> {
    const parentMap: Map<string, ParentLink> = this.createParentLinkMap(storeName);
    return this.updateParentsWithUpdatedLinks(database, storeName, queueMap, parentMap).pipe(
      switchMap((appendedMap) => this.insertLinkedItemsInStores(database, appendedMap)),
      // Map only the requested storeName's content to a list of id keys.
      map((addedMap) => {
        const storeMap: Map<string, Unknown> = addedMap.get(storeName) as Map<string, Unknown>;
        return [database, [...storeMap.keys()]];
      }),
    );
  }

  /**
   * With the given options and content, parse the content for links and create
   * a map of items based on the objectStore names with the content separated by
   * available objectStores and has its content recursively extracted matching
   * the linking options known for each (nested) property for each objectStore.
   */
  public createQueueMap(options: TtPersistenceOptions, content: Unknown[]): QueueMap {
    // Extract all linked items in the content array and create a queue map
    // from it.
    let queueMap: QueueMap = new Map();
    return this.parseContentForLinking(options.storeName, content, queueMap);
  }

  /**
   * Uses the linkMap$ to check if any of the properties in the content are
   * linked items. All the linked items are stored in the linkedItems map, which
   * will be added to the various objectStores after all (nested) content has
   * been parsed.
   */
  public parseContentForLinking(
    storeName: string,
    content: Unknown | Unknown[],
    linkedItems: Map<string, Unknown[]>,
  ): Map<string, Unknown[]> {
    const linkMap: LinkMap = this.databaseService.linkMap;
    const contents: Unknown[] = asArray(content) as Unknown[];
    const current: Unknown[] = linkedItems.get(storeName) ?? [];
    const options: TtPersistenceOptions = this.databaseService.optionsMap.get(storeName) as TtPersistenceOptions;
    const idSet: Set<string> = new Set();
    const linkedToMap: StringMap = linkMap.get(storeName) as StringMap;
    const parsed: Unknown[] = !linkMap.has(storeName) ? contents : contents
      .map((cloneMe: Unknown) => this.extractLinkedContent(cloneMe, linkedToMap, linkedItems));

    const concatenated: Unknown[] = current.concat(parsed)
      .filter((checkMe: Unknown) => {
        const checkId: string = checkMe[options.primaryKey] as string;
        if (idSet.has(checkId)) {
          return false;
        }

        idSet.add(checkId);
        return true;
      });

    linkedItems.set(storeName, concatenated);
    return linkedItems;
  }

  /**
   * Create an observable that wraps around the batch transaction to get all
   * objectStores of the queued items in the QueueMap. The resulting transaction
   * is passed along to the chain of insert Observables, which returns the
   * results of the various transactions in a map. This map sorts its data
   * according to each objectStore and the idKey|value pairs for each
   * successful transaction, like so: `[objectStore -> [idKey, content]]`.
   */
  public insertLinkedItemsInStores(database: IDBDatabase, queuedItems: QueueMap): Observable<AddedMap> {
    return new Observable<IDBTransaction>((subscriber) => {
      const stores: string[] = [...queuedItems.keys()];
      const transaction: IDBTransaction = database.transaction(stores, 'readwrite');
      // Make sure to whine if any of the objectStores is missing.
      transaction.onerror = (event: Event): void => {
        event.preventDefault();
        event.stopPropagation();
        const target: IDBRequest = event.target as IDBRequest;
        const error: DOMException = target.error as DOMException;
        subscriber.error(new IndexedDBStoreError(error?.message as string));
      };

      subscriber.next(transaction);
    }).pipe(
      switchMap((transaction) => this.createBatchInsertObservable(transaction, queuedItems)),
    );
  }

  /**
   * Loop through the linkMap to find any objectStores that have the given
   * storeName as a linked objectStore and return the results as a Map with the
   * parent storeName and the corresponding property.
   */
  public createParentLinkMap(storeName: string, activeMap?: ParentLinkMap): ParentLinkMap {
    const linkMap: LinkMap = this.databaseService.linkMap;
    let parentMap: ParentLinkMap = activeMap ?? new Map();

    for (const [parent, linksToMap] of linkMap) {
      for (const [property, linkStore] of linksToMap) {
        if (linkStore === storeName) {
          const link: ParentLink = {
            storeName: parent,
            childStoreName: storeName,
            property: property,
            idKey: this.databaseService.optionsMap.get(storeName)?.primaryKey as string,
          };
          parentMap.set(parent, link);
          parentMap = this.createParentLinkMap(parent, parentMap);
          parentMap.set(parent, this.updateParentLink(link, parentMap));
        }
      }
    }

    return parentMap;
  }

  /**
   * Loop through the linkedToMap and for each proper match in the content,
   * check if there are links again. Each time this is done, the content is
   * also added to the linkedItems queue.
   */
  private extractLinkedContent(
    content: Unknown,
    linkedToMap: StringMap,
    linkedItems: Map<string, Unknown[]>,
  ): Unknown {
    for (const [property, storeName] of linkedToMap) {
      const options: TtPersistenceOptions = this.databaseService.optionsMap.get(storeName) as TtPersistenceOptions;
      if (!content.hasOwnProperty(property) || typeof content[property] !== 'object') {
        continue;
      }
      // DRY implementation.
      const parseContent: (item: Unknown) => void = (item: Unknown): void => {
        if (!item.hasOwnProperty(options.primaryKey) || typeof item[options.primaryKey] !== 'string') {
          return;
        }
        linkedItems = this.parseContentForLinking(options.storeName, item, linkedItems);
      };

      const nested: Unknown | Unknown[] = content[property as string] as Unknown | Unknown[];
      if (Array.isArray(nested)) {
        nested.map((item) => parseContent(item));
        continue;
      }
      parseContent(nested);
    }

    return content;
  }

  /**
   * Parse the ParentLinkMap for a ParentLink where the childStoreName equals
   * the given storeName and return that ParentLink if it exists.
   */
  private getParentLinkForStore(parentMap: ParentLinkMap, storeName: string): ParentLink | undefined {
    for (const parentLink of parentMap.values()) {
      if (parentLink.childStoreName === storeName) {
        return parentLink;
      }
    }

    return undefined;
  }

  /**
   * Set the parentStoreName for each of the items in the parentMap, if there is
   * a parentStore somewhere in the map, so recursive updating is possible.
   */
  private updateParentLink(link: ParentLink, parentMap: ParentLinkMap): ParentLink {
    for (const [storeName, parentLink] of parentMap) {
      if (parentLink.childStoreName === link.storeName) {
        link.parentStoreName = storeName;
      }
    }

    return link;
  }

  /**
   * Using the ParentLinkMap, get the ParentLink for the given storeName, if
   * any, and update the parent items with the updated content. If the active
   * ParentLink has a parentStoreName, the content is updated recursively to the
   * nearest parent until there are no higher level objects to update.
   */
  private updateParentsWithUpdatedLinks(
    database: IDBDatabase,
    storeName: string,
    queueMap: QueueMap,
    parentMap: ParentLinkMap,
  ): Observable<QueueMap> {
    const storeLink: ParentLink = this.getParentLinkForStore(parentMap, storeName) as ParentLink;
    if (!storeLink) {
      return of(queueMap);
    }

    const content: Unknown[] = queueMap.get(storeLink.childStoreName) ?? [];
    const observable: Observable<QueueMap> = this.createUpdateParentsObservable(database, content, storeLink).pipe(
      map((results: Unknown[]) => queueMap.set(storeLink.storeName, results)),
    );

    if (storeLink.parentStoreName) {
      return observable.pipe(
        mergeMap((contentMap) => this.updateParentsWithUpdatedLinks(
          database,
          storeLink.storeName as string,
          contentMap,
          parentMap,
        )),
      );
    }

    return observable;
  }

  /**
   * Using the ParentLink, create an array of observables that combines the
   * given content with the parent items, if found and return an observable
   * with the parent items.
   */
  private createUpdateParentsObservable(
    database: IDBDatabase,
    content: Unknown[],
    storeLink: ParentLink,
  ): Observable<Unknown[]> {
    const observables: Observable<Unknown>[] = this.createParentLinkObservables(database, storeLink, content);
    const first: Observable<Unknown[]> = observables[0].pipe(map((result) => [result]));
    const rest: Observable<Unknown>[] = observables.slice(1);

    const operators: OperatorFunction<Unknown[], number>[] = rest
      .map((observable) => mergeMap((results: Unknown[]) => observable.pipe(
        map((result) => results.push(result)),
      )));

    //@ts-ignore
    return first.pipe.call(first, ...operators);
  }

  /**
   * Convert the result observable for the parent item and update the nested
   * child content with the newly updated content.
   */
  private createParentLinkObservables(
    database: IDBDatabase,
    parentLink: ParentLink,
    content: Unknown[],
  ): Observable<Unknown>[] {
    return content.map((item) => this.createParentResultObservable(
      database,
      parentLink.storeName,
      parentLink.property,
      this.databaseService.extractUuid(item[parentLink.idKey] as string),
    ).pipe(
      map((result) => {
        item[this.databaseService.idKey] = this.databaseService.extractUuid(item[parentLink.idKey] as string);
        item[this.databaseService.storeKey] = parentLink.childStoreName;
        result[parentLink.property] = item;
        return result;
      })));
  }

  /**
   * Get a parent item via the gpsId value from the item that will be updated,
   * using the index in the parent's objectStore instead of the primary key.
   */
  private createParentResultObservable(
    database: IDBDatabase,
    storeName: string,
    property: string,
    gpsId: string,
  ): Observable<Unknown> {
    return new Observable<Unknown>((subscriber) => {
      const transaction: IDBTransaction = database.transaction(storeName, 'readonly');
      const store: IDBObjectStore = transaction.objectStore(storeName);
      const index: IDBIndex = store.index(property + '.' + this.databaseService.idKey);
      const request: IDBRequest = index.get(gpsId);

      request.onerror = (): void => {
        subscriber.error(request.error?.message);
      };

      request.onsuccess = (): void => {
        subscriber.next(request.result);
      };
    });
  }

  /**
   * Create an observable that wraps the transactions required for all items
   * in the queue to be inserted in the different objectStores in a list of
   * mergeMaps. The returned map is a map with idKey|value pairs for each
   * objectStore: `[objectStore -> [idKey, content]]`. This map is later used
   * for adding items to the store if that option was used in the persistence
   * action.
   */
  private createBatchInsertObservable(transaction: IDBTransaction, queuedItems: QueueMap): Observable<AddedMap> {
    const optionsMap: OptionsMap = this.databaseService.optionsMap;
    const entries: [string, Unknown[]][] = [...queuedItems.entries()];

    const operators: OperatorFunction<AddedMap, AddedMap>[] = entries.slice(1).map(([storeName, content]) => mergeMap((
      addedToStoresMap: AddedMap,
    ) => {
      const store: IDBObjectStore = transaction.objectStore(storeName);
      const options: TtPersistenceOptions = optionsMap.get(storeName) as TtPersistenceOptions;
      const items: Unknown[] = this.addIdKeyToContent(content, options.primaryKey);
      return this.createQueueObservable(store, items).pipe(
        map((queueMap) => addedToStoresMap.set(storeName, queueMap)),
      );
    }));

    const [storeName, content] = entries[0];
    const addedMap: AddedMap = new Map();
    const firstStore: IDBObjectStore = transaction.objectStore(storeName);
    const firstOptions: TtPersistenceOptions = optionsMap.get(storeName) as TtPersistenceOptions;
    const firstInsert: Observable<AddedMap> = this.createQueueObservable(
      firstStore,
      this.addIdKeyToContent(content, firstOptions.primaryKey),
    ).pipe(map((queueMap) => addedMap.set(storeName, queueMap)));

    //@ts-ignore
    return firstInsert.pipe.call(firstInsert, ...operators) as Observable<AddedMap>;
  }

  /**
   * Create an observable that wraps around adding a list of items to the
   * specific objectStore. Only the last transaction is waiting for the success
   * of the transaction, to increase the speed at which the content is added to
   * the objectStore.
   */
  private createQueueObservable(
    store: IDBObjectStore,
    content: Unknown[],
  ): Observable<Map<string, Unknown>> {
    return new Observable<Map<string, Unknown>>((subscriber) => {
      const errors: string[] = [];
      const updated: Map<string, Unknown> = new Map();
      const link: StringMap | undefined = this.databaseService.linkMap.get(store.name);
      const parsed: Unknown[] = this.addRelationsToContent(content, link) as Unknown[];
      let index: number = 0;

      for (const item of parsed) {
        const request: IDBRequest = store.put(item);
        request.onerror = (event): void => {
          event.preventDefault();
          event.stopPropagation();
          errors.push(request.error?.message as string);
          updated.delete(item[this.databaseService.idKey] as string);
        };
        updated.set(item[this.databaseService.idKey] as string, item);
        index++;
        if (index === parsed.length) {
          if (errors.length) {
            subscriber.error(new IndexedDBAddError(store.name, errors));
            return;
          }
          request.onsuccess = (): void => {
            subscriber.next(updated);
          };
        }
      }
    });
  }

  /**
   * Extend the given content with the idKey and storeKey values if the content
   * has links to another objectStore. The returned items are cloned, to prevent
   * the content from being changed and influencing the storage process down the
   * line.
   */
  private addRelationsToContent(content: Unknown | Unknown[], linksToMap?: Map<string, string>): Unknown | Unknown[] {
    if (!linksToMap?.size) {
      return content;
    }
    const isArray: boolean = Array.isArray(content);
    const contents: Unknown[] = asArray(content);
    const mapped: Unknown[] = contents.map((cloneMe) => {
      const item: Unknown = { ...cloneMe };
      for (const [property, linkStore] of linksToMap.entries()) {
        const options: TtPersistenceOptions | undefined = this.databaseService.optionsMap.get(linkStore);
        if (!item.hasOwnProperty(property) || typeof item[property] !== 'object' || !options) {
          continue;
        }

        const asUnknown: Unknown = item[property] as Unknown;
        const unknowns: Unknown[] = asArray<Unknown>(asUnknown);
        const linksAdded: Unknown[] = unknowns
          .filter((dupeMe) => typeof dupeMe === 'object' && dupeMe !== null)
          .map((dupeMe) => {
            const moreLinks: StringMap | undefined = this.databaseService.linkMap.get(options.storeName);
            return {
              ...this.addRelationsToContent({ ...dupeMe }, moreLinks) as Unknown,
              [this.databaseService.storeKey]: options.storeName,
              [this.databaseService.idKey]: this.databaseService.extractUuid(dupeMe[options.primaryKey] as string),
            };
          });

        item[property] = Array.isArray(asUnknown) ? linksAdded : linksAdded[0];
      }

      return item;
    });

    return isArray ? mapped : mapped[0];
  }

  /**
   * Add the `__pkey__` property to the entire batch of items in the content.
   */
  private addIdKeyToContent(content: Unknown[], primaryKey: string): Unknown[] {
    return content.map((item) => {
      const idValue: string = this.databaseService.extractUuid(item[primaryKey] as string);
      return { ...item, [this.databaseService.idKey]: idValue };
    });
  }
}
