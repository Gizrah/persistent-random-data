import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { IndexedDBMissingError } from '../errors/indexeddb-missing.error';
import { IndexedDBAccessError } from '../errors/indexeddb-access.error';
import { IndexedDBUnsupportedError } from '../errors/indexeddb-unsupported.error';
import { PersistenceIndexCleanup } from '../interfaces/persistence-index-cleanup.interface';
import { TtPersistenceIndexTrigger } from '../interfaces/tt-persistence-index-trigger.interface';
import { PersistenceOptionsTrigger } from '../interfaces/persistence-options-trigger.interface';
import { TtPersistenceOptions } from '../interfaces/tt-persistence-options.interface';
import { PersistenceSettings } from '../interfaces/persistence-settings.interface';
import {
  StorageMap,
  LinkMap,
  OptionsMap,
  QueueMap,
  StringMap,
  LinkArray,
  Unknown,
  TriggerMap, StoreTriggerMap,
} from '../interfaces/shared.type';
import { doLog, log, logEnd, logStart } from '../functions/log.function';


type StorageArray = [string, [string, boolean][]][];

/**
 * The DatabaseService handles all matters IndexedDB. Initializing the database,
 * creating indices, storing and updating the user settings are all handled in
 * this service. This service is called by all other GeneratorPersistence
 * services and serves a central hub for all in-memory and localStorage data.
 */
@Injectable()
export class TtPersistenceDatabaseService {

  /**
   * Whether the debug mode is enabled.
   */
  public debug: boolean = false;

  /**
   * Storage key pointing to all objectStore and indexName data.
   */
  public readonly storageKey: string = 'persistence->objectStore';

  /**
   * LocalStorage key containing the settings.
   */
  public readonly settingsKey: string = 'persistence->settings';

  /**
   * Key name that is used to store the extracted UUID or other id string that
   * is the value of the {@see TtPersistenceOptions.primaryKey}.
   */
  public readonly idKey: string = '__pkey__';

  /**
   * Key name that is used to set the objectStore name for parts of persistence
   * objects that are linked to another store.
   */
  public readonly storeKey: string = '__store__';

  /**
   * LocalStorage access point.
   */
  public readonly local: Storage = window.localStorage;

  /**
   * IndexedDB Database stored in a BehaviorSubject, for async manipulation of
   * data.
   */
  private indexedDb$: BehaviorSubject<IDBDatabase | undefined> = new BehaviorSubject<IDBDatabase | undefined>(
    undefined,
  );

  /**
   * Settings stream which hold the overall settings for the various
   * objectStores and the version number.
   */
  private settings$: BehaviorSubject<PersistenceSettings> = new BehaviorSubject<PersistenceSettings>(null as never);

  /**
   * Stream with the actual storage map. This is filled on construction and
   * updated with each {@see self.persist} method call.
   */
  private storageMap$: BehaviorSubject<StorageMap> = new BehaviorSubject<StorageMap>(new Map());

  /**
   * Stream with the link options, that link nested objects in database items
   * to other objectStores.
   */
  private linkMap$: BehaviorSubject<LinkMap> = new BehaviorSubject<LinkMap>(new Map());

  /**
   * Stream with the PersistenceOptions for each objectStore.
   */
  private optionsMap$: BehaviorSubject<OptionsMap> = new BehaviorSubject<OptionsMap>(new Map());

  /**
   * Stream containing the various custom Triggers defined in the
   * PersistenceOptions for each objectStore.
   */
  private triggerMap$: BehaviorSubject<StoreTriggerMap> = new BehaviorSubject<StoreTriggerMap>(new Map());

  /**
   * Stream containing the objectStore name and total results for the last call
   * made. They are reset with every new call to the same objectStore.
   */
  private counterMap$: BehaviorSubject<Map<string, number>> = new BehaviorSubject<Map<string, number>>(new Map());

  /**
   * RegExp to check if (part of) a string is a UUID.
   */
  private uuidRegExp: RegExp = new RegExp(
    /[\da-fA-F]{8}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{12}/i,
  );

  constructor() {
    this.reInitialize();
  }

  /**
   * IndexedDB Database stored in a BehaviorSubject, for async manipulation of
   * data.
   */
  public get database$(): Observable<IDBDatabase | undefined> {
    return this.indexedDb$.asObservable();
  }

  /**
   * Retrieve the current PersistenceSettings.
   */
  public get settings(): PersistenceSettings {
    return this.settings$.value;
  }

  /**
   * Update the in-memory and LocalStorage versions of the PersistenceSettings.
   */
  public set settings(value: PersistenceSettings) {
    this.settings$.next(value);
    this.local.setItem(this.settingsKey, JSON.stringify(value));
  }

  /**
   * Retrieve the StorageMap with the objectStore names and their indices with
   * their unique value status.
   */
  public get storageMap(): StorageMap {
    return this.storageMap$.value;
  }

  /**
   * Update the in-memory and LocalStorage versions of the StorageMap.
   */
  public set storageMap(value: StorageMap) {
    this.storageMap$.next(value);
    const storageArray: [string, [string, boolean][]][] = [...value]
      .map(([storeName, indexMap]) => [storeName, [...indexMap]]);
    this.local.setItem(this.storageKey, JSON.stringify(storageArray));
  }

  /**
   * Retrieve the LinkMap with the objectStore names that have properties that
   * link to other objectStores.
   */
  public get linkMap(): LinkMap {
    return this.linkMap$.value;
  }

  /**
   * Update the in-memory LinkMap.
   */
  public set linkMap(value: LinkMap) {
    this.linkMap$.next(value);
  }

  /**
   * Retrieve the OptionsMap with the objectStore names and the corresponding
   * PersistenceOptions.
   */
  public get optionsMap(): OptionsMap {
    return this.optionsMap$.value;
  }

  /**
   * Update the in-memory OptionsMap.
   */
  public set optionsMap(value: OptionsMap) {
    this.optionsMap$.next(value);
  }

  /**
   * Retrieve the TriggerMap with the various named triggers.
   */
  public get triggerMap(): StoreTriggerMap {
    return this.triggerMap$.value;
  }

  /**
   * Update the in-memory TriggerMap.
   */
  public set triggerMap(value: StoreTriggerMap) {
    this.triggerMap$.next(value);
  }

  /**
   * Update the pagination counter with a new value for the total results of the
   * last GET action.
   */
  public setCounter(storeName: string, value: number): void {
    const map: Map<string, number> = this.counterMap$.value;
    map.set(storeName, value);
  }

  /**
   * Get the last total results count for the given storeName.
   */
  public getCounter(storeName: string): number {
    const map: Map<string, number> = this.counterMap$.value;
    return map.get(storeName) ?? 0;
  }

  /**
   * Find the UUID in the given id string, so it can be used as an index value
   * for the object that will be stored.
   */
  public extractUuid(id: string): string {
    return (String(id).match(this.uuidRegExp) ?? [])[0] ?? id;
  }

  /**
   * Extract the first primary key in the url or, if the routeMap has the
   * route filter set, the UUID at the given index. If the exact toggle is also
   * given, the result will either be the matching value at index, or an empty
   * string.
   */
  public extractPrimaryKey(url: string, index?: number, exact?: boolean): string {
    if (index === undefined) {
      return this.extractUuid(url);
    }
    const matches: string[] = String(url).match(this.uuidRegExp) ?? [];
    return exact ? matches[index] ?? '' : matches[index ?? 0];
  }

  /**
   * Initialize the database and run the upgrade path that determines the
   * structure of the database. Make sure to call the {@see self.persist}
   * method to create the desired structure and queue data to be added to the
   * database once its initialized.
   * Passes the QueueMap and index map through to the next observable.
   */
  public initializeDatabase(
    queueMap: QueueMap,
    indexMap: Map<string, string[]>,
  ): Observable<[QueueMap, Map<string, string[]>, IDBDatabase]> {
    return new Observable((subscriber) => {
      const settings: StorageMap = this.storageMap$.value;
      if (!settings.size) {
        subscriber.next();
        return;
      }

      const request: IDBOpenDBRequest = this.openDatabaseRequest();
      request.onerror = (): void => {
        this.indexedDb$.error(request.error);
        this.indexedDb$.complete();
        subscriber.error(new IndexedDBAccessError(request.error));
      };

      request.onupgradeneeded = (event: Event): void => {
        const database: IDBDatabase = (event.target as IDBRequest)?.result;
        if (!database) {
          subscriber.error(new IndexedDBMissingError());
        }
        this.createOrUpdateObjectStores(database, event);
      };

      request.onsuccess = (): void => {
        const database: IDBDatabase = request.result as IDBDatabase;
        this.indexedDb$.next(database);
        subscriber.next([queueMap, indexMap, database as IDBDatabase]);
      };
    });
  }

  /**
   * Completely remove the database and its content, the settings and storage
   * options and all in-memory content.
   */
  public deleteDatabase(): Observable<void> {
    return new Observable((subscriber) => {
      window.indexedDB.deleteDatabase('PersistentRandomData');
      this.local.removeItem('persistence->objectStore');
      this.local.removeItem('persistence->settings');
      this.indexedDb$.next(undefined);
      this.setPersistenceSettings();
      subscriber.next();
    });
  }

  /**
   * From the given options, add the objectName and the primaryKey to the
   * PersistenceSettings' idKeys and mutations. The settings are also stored
   * locally in the {@see self.settings$} stream.
   */
  public updatePersistenceSettings(options: TtPersistenceOptions): void {
    const settings: PersistenceSettings = this.updateSettingsLinks(this.settings, options);
    // Get and update the optionsMap with the new storeName and options.
    const optionsMap: OptionsMap = this.optionsMap;
    optionsMap.set(options.storeName, options);
    const cleanedUpMap: OptionsMap = new Map();
    for (const [storeName, persistenceOptions] of optionsMap) {
      const cloned: TtPersistenceOptions = { ...persistenceOptions };
      delete cloned.linkedKeys;
      cleanedUpMap.set(storeName, cloned);
    }
    settings.options = [...cleanedUpMap.entries()];
    // Add/overwrite the storeName in the mutations (as Set to prevent doubles).
    const mutationSet: Set<string> = new Set([...settings.mutations.update]);
    mutationSet.add(options.storeName);
    settings.mutations.update = [...mutationSet.keys()];
    settings.version = settings.version + 1;
    // Update the triggers.
    settings.triggers = this.convertTriggerMapToSettingsTriggers();
    // Update the settings and optionsMap streams and update the localStorage.
    this.settings = settings;
    this.optionsMap = optionsMap;
  }

  /**
   * Update (or create) the localStorage settings that are used to initialize
   * the database on creation and/or on-update. The same settings are stored
   * locally in the {@see self.storageMap$} stream.
   */
  public updateStorageSettings(linkedItems: Map<string, Unknown[]>): Map<string, string[]> {
    const optionsMap: OptionsMap = this.optionsMap;
    const storageMap: StorageMap = this.storageMap;
    const storeIndexMap: Map<string, string[]> = new Map();

    // Loop through all the linked items and get the options from the storeName.
    for (const [storeName, content] of linkedItems.entries()) {
      const options: TtPersistenceOptions = optionsMap.get(storeName) as TtPersistenceOptions;
      const keyMap: Map<string, boolean> = this.createKeyMap(content, options);
      storeIndexMap.set(storeName, [...keyMap.keys()]);
      const storedMap: Map<string, boolean> | undefined = storageMap.get(storeName) ?? new Map();
      const combinedMap: Map<string, boolean> = new Map([...storedMap.entries(), ...keyMap.entries()]);
      storageMap.set(storeName, combinedMap);
    }

    this.storageMap = storageMap;
    return storeIndexMap;
  }

  /**
   * Any content that is in the database will have a `__pkey__` column that
   * needs to be removed, since it's not part of the original object. The entire
   * column is there because keyPaths can't start with an `@` symbol, so `@id`
   * is not a valid keyPath.
   */
  public removeGeneratedIdKeyFromContent(content: Unknown | Unknown[]): Unknown | Unknown[] {
    const cleanNested: (item: Unknown) => Unknown = (item: Unknown): Unknown => {
      const removed: Unknown = Object.assign({}, item);
      for (const key of Object.keys(removed)) {
        if (Array.isArray(removed[key]) || typeof removed[key] === 'object' && !!removed[key]) {
          removed[key] = this.removeGeneratedIdKeyFromContent(removed[key] as Unknown | Unknown[]);
        }
      }
      delete removed[this.idKey];
      delete removed[this.storeKey];
      return removed;
    };

    if (Array.isArray(content)) {
      return content.map((item) => cleanNested(item));
    }
    return cleanNested(content);
  }

  /**
   * Convert the LinkMap back to the LinkArray, which can be serialized to JSON,
   * which is required for localStorage.
   */
  public convertLinkMapToSettingsLink(linkMap: LinkMap): LinkArray {
    const linkArray: LinkArray = [];
    for (const [storeName, propertyMap] of linkMap) {
      linkArray.push([storeName, [...propertyMap.entries()]]);
    }
    return linkArray;
  }

  /**
   * Reinitialize the database on construction, or after a database reinstall.
   */
  public reInitialize(): void {
    this.setDatabaseSettings();
    this.setPersistenceSettings();
    this.initializeDatabase(new Map(), new Map()).pipe(take(1)).subscribe();
  }

  /**
   * Using the localStorage, get the JSON database settings and convert them
   * to the StorageMap, and update the storageMap$ stream.
   */
  private setDatabaseSettings(): void {
    const mapString: string | null = this.local.getItem(this.storageKey);
    if (!mapString) {
      return;
    }

    const parsed: StorageArray = JSON.parse(mapString);
    const firstMap: Map<string, unknown> = new Map(
      Array.isArray(parsed) && Array.isArray(parsed[0])
        ? parsed
        : [],
    );

    for (const [key, value] of firstMap.entries()) {
      const secondMap: Map<string, boolean> = new Map(
        Array.isArray(value)
          ? value
          : [],
      );
      firstMap.set(key, secondMap);
    }

    this.storageMap$.next(firstMap as StorageMap);
  }

  /**
   * Using the localStorage, get the JSON value for the stored persistence
   * settings and split the content between the general PersistenceSettings in
   * the settings$ stream, the linking options in the linkMap$ stream and the
   * objectStore's primary key value to the idKeyMap$ stream.
   */
  private setPersistenceSettings(): void {
    const settingsString: string | null = this.local.getItem(this.settingsKey);

    if (!settingsString) {
      this.settings$
        .next({ version: 0, options: [], links: [], mutations: { update: [], remove: [], indices: [] }, triggers: [] });
      this.linkMap = new Map();
      this.optionsMap = new Map();
      this.linkMap = new Map();
      this.triggerMap = new Map();
      return;
    }

    const settings: PersistenceSettings = JSON.parse(settingsString);
    this.optionsMap = new Map(settings.options);
    this.linkMap = this.convertSettingsLinksToLinkMap(settings);
    this.triggerMap = this.convertSettingsTriggersToTriggerMap(settings.triggers);
    this.settings = settings;
  }

  /**
   * Update the persistence linking options, converting the stored map-as-array
   * back to a map with a map with the settings and updating the stream. If the
   * new options holds a map with linkedKeys, they are added to the linkMap. If
   * not, the linkMap is updated regardless, so database initialization also
   * fills the various streams.
   */
  private updateSettingsLinks(settings: PersistenceSettings, options: TtPersistenceOptions): PersistenceSettings {
    // storeName -> propertyName -> { storeName, primaryKey }
    const linkMap: LinkMap = this.convertSettingsLinksToLinkMap(settings);
    this.triggerMap = this.convertSettingsTriggersToTriggerMap(settings.triggers);
    this.optionsMap = new Map(settings.options) ?? new Map();
    // Recursively set the linkMap.
    this.flattenPersistenceLinkOptions(options, linkMap);
    // Just in case nothing was added, update the linkMap$ stream.
    this.linkMap = linkMap;
    // Convert the linkMap back to a JSON.stringify passable object.
    settings.links = this.convertLinkMapToSettingsLink(linkMap);
    return settings;
  }

  /**
   * First, store the current set of options in the OptionsMap stream. Second,
   * flatten the PersistenceOptions' linkedKeys map to a nice list of linked
   * objectStores and update the linkMap$ stream with the new map. This is done
   * recursively, so that any linkedKeys -> PersistenceOptions.linkedKeys -> ...
   * is also set in the linkMap$.
   */
  private flattenPersistenceLinkOptions(options: TtPersistenceOptions, linkMap: LinkMap): void {
    const optionsMap: OptionsMap = this.optionsMap;
    if (!optionsMap.has(options.storeName)) {
      optionsMap.set(options.storeName, options);
    }

    this.updateTriggerMap(options);

    if (options.linkedKeys) {
      const propertyMap: StringMap = linkMap.get(options.storeName) ?? new Map();
      for (const [property, linkOptions] of options.linkedKeys) {
        propertyMap.set(property, linkOptions.storeName);
        linkMap.set(options.storeName, propertyMap);
        this.linkMap = linkMap;
        // If there are more linkedKeys, flatten some more.
        this.flattenPersistenceLinkOptions(linkOptions, linkMap);
      }
    }
  }

  /**
   * Convert the LinkArray to a LinkMap. This is much easier to access and
   * update during runtime than parsing an array would.
   */
  private convertSettingsLinksToLinkMap(settings: PersistenceSettings): LinkMap {
    // [storeName, [propertyName, linkedStore][] ][]
    const linkArray: LinkArray = settings.links ?? [];
    const linkMap: LinkMap = new Map();

    for (const [storeName, propertyArray] of linkArray) {
      const linkedToMap: StringMap = new Map(propertyArray);
      linkMap.set(storeName, linkedToMap);
    }

    return linkMap;
  }

  /**
   * Create or update an existing TriggerMap for the storeName in the options.
   */
  private updateTriggerMap(options: TtPersistenceOptions): void {
    const storeMap: StoreTriggerMap = this.triggerMap;
    const triggerMap: TriggerMap = this.createTriggerMap(options.storeName, options.triggers);
    storeMap.set(options.storeName, triggerMap);
    this.triggerMap = storeMap;
  }

  /**
   * Convert the StoreTriggerMap to an array of PersistenceOptionsTriggers for
   * easier storage.
   */
  private convertTriggerMapToSettingsTriggers(): PersistenceOptionsTrigger[] {
    let triggers: PersistenceOptionsTrigger[] = [];
    for (const triggerMap of this.triggerMap.values()) {
      triggers = triggers.concat([...triggerMap.values()]);
    }
    return triggers;
  }

  /**
   * Create a StoreTriggerMap from the stored PersistenceOptionsTriggers.
   */
  private convertSettingsTriggersToTriggerMap(triggers: PersistenceOptionsTrigger[]): StoreTriggerMap {
    const storeTriggerMap: StoreTriggerMap = new Map();
    for (const trigger of triggers) {
      if (!storeTriggerMap.has(trigger.storeName)) {
        storeTriggerMap.set(trigger.storeName, new Map());
      }

      const triggerMap: TriggerMap = storeTriggerMap.get(trigger.storeName) as TriggerMap;
      triggerMap.set(trigger.name, trigger);
      storeTriggerMap.set(trigger.storeName, triggerMap);
    }

    return storeTriggerMap;
  }

  /**
   * Create a TriggerMap for the given objectStore, converting the Index
   * triggers to Option triggers in the process.
   */
  private createTriggerMap(storeName: string, triggers?: TtPersistenceIndexTrigger[]): TriggerMap {
    const triggerMap: TriggerMap = this.triggerMap.get(storeName) ?? new Map();

    if (!triggers || !triggers?.length) {
      return triggerMap;
    }

    for (const trigger of triggers) {
      triggerMap.set(trigger.name, this.convertIndexTrigger(storeName, trigger));
    }

    return triggerMap;
  }

  /**
   * Convert the Index trigger to an Options trigger, creating the keyPath and
   * index values used by the objectStore to create the indices.
   */
  private convertIndexTrigger(storeName: string, trigger: TtPersistenceIndexTrigger): PersistenceOptionsTrigger {
    const option: PersistenceOptionsTrigger = {
      ...trigger,
      storeName: storeName,
      index: '',
      keyPath: [],
    };

    for (const rule of trigger.rules) {
      const path: string = rule.primaryKey ? `${rule.property}.${this.idKey}` : rule.property;
      option.keyPath.push(path);

      if (!('search' in rule) || !rule?.search || !rule?.searchIn?.length) {
        continue;
      }

      const noPath: string[] = option.keyPath.filter((item) => item !== path);
      option.searchIn = option.searchIn ?? [];
      option.searchIn.push([noPath.join(', '), noPath]);

      for (const key of rule.searchIn) {
        if (typeof key === 'object') {
          continue;
        }
        const searchPath: string[] = [...noPath, key];
        option.searchIn.push([searchPath.join(', '), searchPath]);
      }
    }

    option.index = option.keyPath.join(', ');
    return option;
  }

  /**
   * Reduces one or more objects, up to a maximum of 20, to a Map of keys with a
   * matched unique flag. It parses more than one item if an array is given, so
   * that any discrepancies between the items are also taken into account when
   * creating the Key map.
   */
  private createKeyMap(content: Unknown[], options: TtPersistenceOptions): Map<string, boolean> {
    const keyMap: Map<string, boolean> = content
      .slice(0, 20)
      .reduce((combinedMap: Map<string, boolean>, item: Unknown) => {
        return this.createKeyMapForItem(item, combinedMap, options, undefined);
      }, new Map());
    keyMap.set(this.idKey, true);

    return keyMap;
  }

  /**
   * Parse the item for the type of keys it has and determine whether they
   * shall and can be added to the given keyMap. All the keys represent a
   * possible index for data of nested objects.
   */
  // eslint-disable-next-line complexity
  private createKeyMapForItem(
    item: Unknown,
    keyMap: Map<string, boolean>,
    options?: TtPersistenceOptions,
    path?: string,
  ): Map<string, boolean> {
    const uniques: string[] = options?.uniqueKeys ?? [];
    const linkMap: LinkMap = this.linkMap;
    const optionsMap: OptionsMap = this.optionsMap;
    for (const key of Object.keys(item)) {
      const basePath: string = path ? path + '.' : '';
      const keyPath: string = `${basePath}${key}`;
      // Key must start with a letter, underscore or dollar sign to be a
      // valid keyPath. Dashes are not valid either.
      if (!/^[a-zA-Z_$]/.test(key) || keyMap.has(keyPath) || key.includes('-')) {
        continue;
      }
      // Arrays and booleans don't index, so skip 'em.
      if (Array.isArray(item[key]) || typeof item[key] === 'boolean') {
        continue;
      }
      // If it's a plain object, create key indices.
      if (typeof item[key] === 'object') {
        const optionsKey: string | undefined = linkMap.get(options?.storeName as string)?.get(key);
        const keyOptions: TtPersistenceOptions | undefined = optionsMap.get(optionsKey as string);
        keyMap = this.createKeyMapForItem(item[key] as Unknown, keyMap, keyOptions, keyPath);
        if (keyOptions) {
          keyMap = this.addLinkedKeyPaths(keyPath, keyMap);
          continue;
        }
      }
      keyMap.set(keyPath, uniques.includes(key));
    }
    return keyMap;
  }

  /**
   * Add the keyPath idKey and storeKey values to the indices that are going to
   * be added for this objectStore. The keyPath parameter will be used as a
   * prefix, since dot-seperated indices are allowed for the objectStore.
   */
  private addLinkedKeyPaths(keyPath: string, keyMap: Map<string, boolean>): Map<string, boolean> {
    const idKeyPath: string = `${keyPath}.${this.idKey}`;

    if (keyMap.has(idKeyPath)) {
      return keyMap;
    }

    keyMap.set(idKeyPath, false);
    return keyMap;
  }

  /**
   * Check if IndexedDB is accessible, close the current database if available
   * and return a new connection request to the database.
   */
  private openDatabaseRequest(): IDBOpenDBRequest {
    if (!window.indexedDB) {
      this.indexedDb$.next(undefined as never);
      this.indexedDb$.complete();
      throw new IndexedDBUnsupportedError();
    }

    const settings: PersistenceSettings = this.settings$.value;
    const active: IDBDatabase | undefined = this.indexedDb$.value;
    active?.close();

    return window.indexedDB.open('PersistentRandomData', settings.version);
  }

  /**
   * Update the database structure using the StorageMap and PersistenceSettings
   * that were set earlier in the chain. If the user persists content in an
   * already existing objectStore, the objectStore is unceremoniously yeeted
   * before being recreated with the newly created indices. If the user has
   * requested for an objectStore to be removed, that is handled here, as well
   * as the clean-up of superfluous indices on other objectStores due to the
   * deletion of an objectStore.
   */
  private createOrUpdateObjectStores(database: IDBDatabase, event: Event): void {
    this.handleObjectStoreUpdates(database);
    this.handleObjectStoreRemovals(database);
    this.handleObjectStoreIndices(database, event);

    this.settings = this.settings;
  }

  /**
   * Handle all updates to the objectStores using the data in the StorageMap.
   */
  // eslint-disable-next-line max-lines-per-function
  private handleObjectStoreUpdates(database: IDBDatabase): void {
    const storageMap: StorageMap = this.storageMap;
    const settings: PersistenceSettings = this.settings;
    const updates: string[] = settings.mutations.update;

    if (!updates.length) {
      return;
    }

    doLog(this.debug, logStart, 'INDEX CREATION');
    for (const [storeName, indices] of storageMap) {
      doLog(this.debug, logStart, 'INDICES FOR:', storeName);
      const exists: boolean = database.objectStoreNames.contains(storeName);
      const update: boolean = updates.includes(storeName);
      const triggers: PersistenceOptionsTrigger[] = settings.triggers
        .filter((trigger) => trigger.storeName === storeName);

      if (exists && !update) {
        doLog(this.debug, logEnd, 'STORE EXISTS, NO UPDATING NEEDED');
        continue;
      }

      if (exists && update) {
        doLog(this.debug, log, 'YEETING OBJECTSTORE');
        database.deleteObjectStore(storeName);
      }

      const store: IDBObjectStore = database.createObjectStore(storeName, { keyPath: this.idKey });
      doLog(this.debug, log, 'CREATING INDICES');
      this.createIndices(store, indices);
      doLog(this.debug, logEnd, 'TRIGGERS:', triggers);
      this.createTriggerIndices(store, triggers);
    }

    settings.mutations.update = [];
    this.settings$.next(settings);
    doLog(this.debug, logEnd);
  }

  /**
   * Handle all objectStore removals, updating the StorageMap if the storeNames
   * are still found in it.
   */
  private handleObjectStoreRemovals(database: IDBDatabase): void {
    const storageMap: StorageMap = this.storageMap;
    const settings: PersistenceSettings = this.settings;
    const removals: string[] = settings.mutations.remove;

    if (!removals.length) {
      return;
    }

    for (const storeName of removals) {
      const exists: boolean = database.objectStoreNames.contains(storeName);
      if (!exists) {
        continue;
      }

      database.deleteObjectStore(storeName);
      storageMap.delete(storeName);
    }

    this.storageMap = storageMap;
    settings.mutations.remove = [];
    this.settings$.next(settings);
  }

  /**
   * Prune superfluous indices from removed objectStores.
   */
  private handleObjectStoreIndices(database: IDBDatabase, event: Event): void {
    const settings: PersistenceSettings = this.settings;
    const cleanups: PersistenceIndexCleanup[] = settings.mutations.indices;
    const storeNames: string[] = cleanups
      .map((item) => item.storeName)
      .filter((name) => database.objectStoreNames.contains(name));
    const openRequest: IDBOpenDBRequest = event.target as IDBOpenDBRequest;

    if (!cleanups.length) {
      return;
    }

    for (const storeName of storeNames) {
      const store: IDBObjectStore | undefined = openRequest.transaction?.objectStore(storeName);
      if (!store) {
        continue;
      }
      const cleanup: PersistenceIndexCleanup = cleanups
        .find((item) => item.storeName === storeName) as PersistenceIndexCleanup;
      const parsed: string[] = cleanup.indices.filter((index) => store.indexNames.contains(index));

      for (const index of parsed) {
        store.deleteIndex(index);
      }
    }

    settings.mutations.indices = [];
    this.settings$.next(settings);
  }

  /**
   * Create the indices in the objectStore for all the keys in the map, with the
   * unique flag set to whatever was stored. The main `__pkey__` is always a
   * unique key, whereas the idKeys for related or nested items are not set as
   * unique, to make relations make sense.
   */
  private createIndices(store: IDBObjectStore, keyMap: Map<string, boolean>): void {
    for (const [key, value] of keyMap.entries()) {
      doLog(this.debug, log, 'KEYMAP KEY:', key);
      if (store.indexNames.contains(key) || key === this.idKey || !/^[a-zA-Z_$]/.test(key) || key.includes('-')) {
        doLog(this.debug, log, 'KEY SKIPPED');
        continue;
      }

      doLog(this.debug, log, 'CREATING INDEX FOR KEY');
      store.createIndex(key, key, { unique: value });
    }
  }

  /**
   * Applies the custom trigger indices to the given objectStore.
   */
  private createTriggerIndices(store: IDBObjectStore, triggers: PersistenceOptionsTrigger[]): void {
    for (const trigger of triggers) {
      doLog(this.debug, log, 'TRIGGER:', trigger.name);
      doLog(this.debug, log, trigger);
      if (store.indexNames.contains(trigger.index)) {
        continue;
      }
      doLog(this.debug, log, 'CREATING INDEX FOR TRIGGER KEY/PATH:', trigger.index, trigger.keyPath);
      store.createIndex(trigger.index, trigger.keyPath);

      if (!trigger.searchIn?.length) {
        continue;
      }

      for (const [idx, keyPath] of trigger.searchIn) {
        if (store.indexNames.contains(idx)) {
          continue;
        }
        doLog(this.debug, log, 'CREATING INDEX FOR SEARCHIN PATH:', idx, keyPath);
        store.createIndex(idx, keyPath);
      }
    }
  }
}
