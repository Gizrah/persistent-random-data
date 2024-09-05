import { HttpParams, HttpRequest } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import {
  BehaviorSubject,
  firstValueFrom,
  from,
  mergeMap,
  Observable,
  of,
  OperatorFunction, throwError,
} from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { TtPersistenceFormatterMissingError } from './errors/formatter-missing.error';
import { NoPrimaryKeyInObjectError } from './errors/no-primary-key-in-object.error';
import { NoPrimaryKeyInSettingsError } from './errors/no-primary-key-in-settings.error';
import { NoPrimaryKeyInUrlError } from './errors/no-primary-key-in-url.error';
import { TriggerNotFoundError } from './errors/trigger-not-found.error';
import { asArray } from './functions/as-array.function';
import { TtPersistenceRouteState } from './interfaces/tt-persistence-route-state.interface';
import { TtPersistenceJoiner } from './interfaces/tt-persistence-joiner.interface';
import { PersistenceOptionsTrigger } from './interfaces/persistence-options-trigger.interface';
import { TtPersistenceOptions } from './interfaces/tt-persistence-options.interface';
import { TtPersistenceRouteMap } from './interfaces/tt-persistence-route-map.interface';
import {
  RetrieveByKeyOptions,
  RetrieveByPageOptions,
  RetrieveBySearchOptions,
  RetrieveBySortingOptions,
} from './interfaces/retrieve-options.interface';
import { TtFilterCallback, TtPersistenceCombiner, TtPersistenceFormatter } from './interfaces/shared.type';
import { TtPersistenceRequestOption } from './interfaces/tt-persistence-request-option.enum';
import { TtPersistenceRouteFilter } from './interfaces/tt-persistence-route-filter.interface';
import { TtPersistenceConfigModel } from './models/tt-persistence-config.model';
import { TtPersistenceDatabaseService } from './services/tt-persistence-database.service';
import { TtPersistenceStoreService } from './services/tt-persistence-store.service';
import { TtPersistenceService } from './tt-persistence.service';
import { simpleCompare } from './functions/simple-compare.function';
import { doLog, log, logEnd, logStart } from './functions/log.function';

type ParamMatcher<T> = (options: T, params: HttpParams, param: string, type: TtPersistenceRequestOption) => T;
type OperatorTT<T> = OperatorFunction<T | T[], T | T[]>;

/**
 * Bridging service between the interceptor and the Persistence services, in
 * charge of handling requests and calling the appropriate methods in the
 * various services.
 */
@Injectable()
export class TtPersistenceStateService {

  /**
   * RegExp to check if (part of) a string is a UUID.
   */
  private uuidRegExp: RegExp = new RegExp(
    /[\da-fA-F]{8}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{12}/,
    'gi',
  );

  /**
   * Key used to store the active state of the interceptor in localStorage, so
   * the application resumes its previous setting.
   */
  private interceptorKey: string = 'persistence->intercept';

  /**
   * Key used to store the active state of skipping authentication, so the user
   * isn't prompted to log in immediately after each page reload.
   */
  private skipKey: string = 'persistence->skip_auth';

  /**
   * Key used to store that the authentication details set in the config by the
   * authenticator function have been stored.
   */
  private authKey: string = 'persistence->authenticated';

  /**
   * Key used to store that the factory function that seeds the data has been
   * stored in the database already, so new seeding isn't needed.
   */
  private seedKey: string = 'persistence->seeded';

  /**
   * Key used to store route active and skipped states. These can be set by
   * adding the 'skip' property in a route or route method, but can be
   * overridden.
   */
  private routeKey: string = 'persistence->routes';

  /**
   * A Map containing a route with the UUID replaced as `{{uuid}}` and the
   * matching {@see TtPersistenceRouteMap} config.
   */
  private routeMap: Map<string, TtPersistenceRouteMap> = new Map();

  /**
   * Map containing all registered parameters and their corresponding type of
   * parameter option.
   */
  private paramOptionMap: Map<string, TtPersistenceRequestOption> = new Map();

  /**
   * Map containing all parameter options and a set of corresponding http
   * parameter values.
   */
  private optionParamsMap: Map<TtPersistenceRequestOption, Set<string>> = new Map();

  /**
   * Map containing all routes and their active/skip states.
   */
  private routeStateMap: Map<string, TtPersistenceRouteState> = new Map();

  /**
   * Current state for usage of persistent generated data.
   */
  private interceptor$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

  /**
   * Current auth skip state usage. True means login is skipped.
   */
  private fake$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

  /**
   * Current authentication setup state. Default false. True means that a spoof
   * user has been set up.
   */
  private authenticated$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Current seeded setup state. Default false. True means that the seeder
   * function has been called.
   */
  private seeded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Observable with the array of route states. These can be used to toggle
   * route states more easily.
   */
  private routeStates$: BehaviorSubject<TtPersistenceRouteState[]> = new BehaviorSubject<TtPersistenceRouteState[]>([]);

  /**
   * Seeding loader state.
   */
  private seedingState$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    private config: TtPersistenceConfigModel,
    private persistence: TtPersistenceService,
    private databaseService: TtPersistenceDatabaseService,
    private storeService: TtPersistenceStoreService,
    private injector: Injector,
  ) {
    this.parseConfigMapping(config);
    this.setupStates();
    this.setupRouteStates();
    this.databaseService.debug = config.debug;
  }

  /**
   * Getter for the state of intercepting data using GeneratorPersistence.
   */
  public get interceptor(): boolean {
    return this.interceptor$.value;
  }

  /**
   * Getter for the usage of login credentials. Auth skipping is always false if
   * the data interception is disabled.
   */
  public get fake(): boolean {
    return this.interceptor && this.fake$.value;
  }

  /**
   * Getter for the called state of the authenticator function in the
   * PersistenceConfig, if it exists.
   */
  public get authenticated(): boolean {
    return this.authenticated$.value;
  }

  /**
   * Getter for the called state of the factory function
   */
  public get seeded(): boolean {
    return this.seeded$.value;
  }

  /**
   * Getter for all RouteState objects for each of the stored routes.
   */
  public get states$(): Observable<TtPersistenceRouteState[]> {
    return this.routeStates$.asObservable();
  }

  /**
   * Observable stream for the current seeding state.
   */
  public get seeding$(): Observable<boolean> {
    return this.seedingState$.asObservable();
  }

  /**
   * Check if the debug state is enabled.
   */
  public get debug(): boolean {
    return this.config.debug === true;
  }

  /**
   * Debugging function that splits the url on a config-defined value for better
   * legibility.
   */
  public debugRoute(url: string): string {
    if (this.config.debugSplitUrlOn) {
      return url.split(this.config.debugSplitUrlOn)[1];
    }
    return url;
  }

  /**
   * Toggle the usage of persistent generated data.
   */
  public toggleState(state?: boolean): void {
    const current: boolean = this.interceptor;
    const change: boolean = state !== undefined ? state : !current;
    this.databaseService.local.setItem(this.interceptorKey, String(change));
    this.interceptor$.next(change);
  }

  /**
   * Toggle the usage of fake login credentials.
   */
  public toggleSkipAuth(state?: boolean): void {
    const current: boolean = this.fake;
    const change: boolean = state !== undefined ? state : !current;
    this.databaseService.local.setItem(this.skipKey, String(change));
    this.fake$.next(change);
  }

  /**
   * Toggle the stored authenticated state. If set to false, the next page
   * reload will re-initialize the authenticator function from the config.
   */
  public toggleAuthenticated(state?: boolean): void {
    const current: boolean = this.authenticated;
    const change: boolean = state !== undefined ? state : !current;
    this.databaseService.local.setItem(this.authKey, String(change));
    this.authenticated$.next(change);
  }

  /**
   * Toggle the stored seeded state. If set to false, the next page reload will
   * run the seeder factory function.
   */
  public toggleSeeded(state?: boolean): void {
    const current: boolean = this.seeded;
    const change: boolean = state !== undefined ? state : !current;
    this.databaseService.local.setItem(this.seedKey, String(change));
    this.seeded$.next(change);
  }

  /**
   * Toggle a stored route's skip-state. If set to skipped, the interceptor
   * will ignore the route, even if its method is defined. If the no-operation
   * boolean toggle is set, the route toggle is not stored and will only last
   * while the application is not reloaded.
   */
  public toggleRoute(route: string, skip: boolean, method?: string, noop?: boolean): void {
    const key: string = route + (method ? `.${method}` : '');
    const status: TtPersistenceRouteState | undefined = this.routeStateMap.get(key) ?? {
      route: route,
      method: method,
      skip: skip,
    };

    status.skip = skip;
    this.routeStateMap.set(key, status);
    const states: TtPersistenceRouteState[] = [...this.routeStateMap.values()];
    this.routeStates$.next(states);
    if (!noop) {
      const toString: string = JSON.stringify(states);
      this.databaseService.local.setItem(this.routeKey, toString);
    }
  }

  /**
   * Async check to see if the authenticator function in the config is available
   * and has been called. Method will call the authenticator function and update
   * the in-memory and localStorage keys for next check.
   */
  public async authenticate(): Promise<boolean> {
    if (this.authenticated) {
      return true;
    }

    if (!this.config.authenticator) {
      return false;
    }

    await this.config.authenticator(this.injector);
    this.toggleAuthenticated(true);
    return true;
  }

  /**
   * Async check to see if a seeder function is available in the config and has
   * been called. Method will call the seeder function and persist the data,
   * after which the in-memory and localStorage keys are updated for next check.
   */
  public async seed(): Promise<boolean> {
    if (this.seeded) {
      return true;
    }

    if (!this.config.seeder) {
      return false;
    }

    this.seedingState$.next(true);
    await this.config.seeder(this.persistence, this.persistence.extractor, this.persistence.generator);
    this.toggleSeeded(true);
    this.seedingState$.next(false);
    return true;
  }

  /**
   * Delete the database and all stored settings.
   */
  public async uninstall(clearRoutes?: boolean): Promise<void> {
    this.toggleState(false);
    this.toggleSeeded(false);
    this.toggleAuthenticated(false);
    this.toggleSkipAuth(false);

    await firstValueFrom(this.databaseService.deleteDatabase());
    this.databaseService.local.removeItem('persistence->intercept');
    this.databaseService.local.removeItem('persistence->skip_auth');
    this.databaseService.local.removeItem('persistence->authenticated');
    this.databaseService.local.removeItem('persistence->seeded');
    if (clearRoutes) {
      this.databaseService.local.removeItem('persistence->routes');
    }
  }

  /**
   * Reinstall the service, removing all settings and the current database,
   * before restarting all (async) functions.
   */
  public async reinstall(): Promise<void> {
    this.seedingState$.next(true);
    await this.uninstall();

    this.databaseService.reInitialize();

    this.parseConfigMapping(this.config);
    this.setupStates();
    this.setupRouteStates();

    await this.authenticate();
    await this.seed();
  }

  /**
   * Map a full route path to an objectStore and its options.
   */
  public mapRoute(routeMap: TtPersistenceRouteMap): void {
    this.routeMap.set(this.cleanRoute(routeMap.url), routeMap);
  }

  /**
   * Unmap a route manually for a specific method. If no other methods are
   * available for that route, the route is removed from the route map.
   */
  public unmapRoute(route: string): void {
    this.routeMap.delete(this.cleanRoute(route));
  }

  /**
   * Set the RequestOption mapping for a specific HttpParameter used by the
   * persistence services to determine the type of request and what to return.
   */
  public setRequestOption(value: string, option: TtPersistenceRequestOption): void {
    this.paramOptionMap.set(value, option);
    const valueSet: Set<string> = this.optionParamsMap.get(option) ?? new Set();
    valueSet.add(value);
    this.optionParamsMap.set(option, valueSet);
  }

  /**
   * Unset a RequestOption manually.
   */
  public unsetRequestOption(value: string): void {
    const option: TtPersistenceRequestOption | undefined = this.paramOptionMap.get(value);
    if (!option) {
      return;
    }

    this.paramOptionMap.delete(value);
    const valueSet: Set<string> | undefined = this.optionParamsMap.get(option);
    if (!valueSet) {
      return;
    }
    valueSet.delete(value);
    this.optionParamsMap.set(option, valueSet);
  }

  /**
   * Get the storeName associated with the given route, if it exists.
   */
  public getStoreName(route: string): string | undefined {
    return this.routeMap.get(this.cleanRoute(route))?.storeName;
  }

  /**
   * Determine if the given route is available in the routesMap map. Takes
   * into account whether a skip is enabled on the route or method.
   */
  public hasRoute(route: string, method: string, debug: boolean = true): boolean {
    const index: string = this.cleanRoute(route);
    const parsed: string = method.toLowerCase();
    if (!this.routeMap.has(index)) {
      doLog(this.debug && debug, log, 'ROUTE NOT MATCHING ANY ROUTEMAP');
      return false;
    }

    const routeMap: TtPersistenceRouteMap = this.routeMap.get(index);
    const routeState: TtPersistenceRouteState = this.routeStateMap.get(index);
    if (routeState.skip || !(parsed in routeMap)) {
      doLog(this.debug && debug, log, routeState.skip ? 'SKIPPING ROUTE' : 'METHOD NOT IN ROUTEMAP');
      return false;
    }

    const methodState: TtPersistenceRouteState = this.routeStateMap.get(`${index}.${parsed}`);
    doLog(this.debug && debug, log, methodState?.skip ? 'SKIPPING ROUTE METHOD' : 'FOUND ROUTE METHOD');
    return !methodState?.skip;
  }

  /**
   * Returns the TtPersistenceRouteMap for the given route and method. Can be
   * undefined, so preferably use after `hasRoute`.
   */
  public getRoute(route: string): TtPersistenceRouteMap {
    return this.routeMap.get(this.cleanRoute(route)) as TtPersistenceRouteMap;
  }

  /**
   * Extract a UUID from the given route. An index can be provided, in case more
   * than one UUID is found in the route. If the exact boolean toggle is given,
   * an empty string will be returned if no UUID was found at the given index.
   */
  public extractPrimaryKey(route: string, index: number = 0, exact?: boolean): string {
    return this.databaseService.extractPrimaryKey(route, index, exact);
  }

  /**
   * Handle the request depending on the method defined in the request. If the
   * parsed url has no corresponding {@see TtPersistenceRouteMap}, null is
   * returned and the call will be forwarded to the actual url.
   */
  public handleRequest<T>(request: HttpRequest<T>): Observable<T | T[]> | null {
    if (!this.hasRoute(request.url, request.method)) {
      return null;
    }
    doLog(this.debug, logStart, 'HANDLE REQUEST');
    const routeMap: TtPersistenceRouteMap = this.getRoute(request.url);
    doLog(this.debug, log, 'ROUTEMAP:', routeMap);
    switch (request.method) {
      case 'GET':
        const get$: Observable<T | T[]> = this.handleGetRequest(request, routeMap);
        const format$: Observable<T | T[]> = this.handleFormatter(get$, routeMap, request);
        doLog(this.debug, logEnd);
        return this.handleJoiner(format$, routeMap, request);
      case 'PUT':
      case 'PATCH':
        doLog(this.debug, logEnd);
        return this.handlePutRequest(request, routeMap);
      case 'POST':
        doLog(this.debug, logEnd);
        return this.handlePostRequest(request, routeMap);
      case 'DELETE':
        doLog(this.debug, logEnd);
        return this.handleDeleteRequest(request, routeMap);
      default:
        doLog(this.debug, logEnd);
        return null;
    }
  }

  /**
   * Handle the GET request. It is checked for all stored options in the
   * routeMap, parameter matches and filtering. Depending on the matching
   * parameter types, or if a filter function has been set, different retrieval
   * functions are called in the RetrieveService.
   */
  // eslint-disable-next-line max-lines-per-function
  private handleGetRequest<T>(request: HttpRequest<T>, routeMap: TtPersistenceRouteMap): Observable<T | T[]> {
    const storeName: string = routeMap.get.storeName ?? routeMap.storeName;
    const sortOptions: RetrieveBySortingOptions | undefined = this.matchSortingParameters(request.params);
    const pageOptions: RetrieveByPageOptions | undefined = this.matchParameters(request, this.matchPaginationOption);
    const searchOptions: RetrieveBySearchOptions | undefined = this.matchParameters(request, this.matchSearchOption);

    if (routeMap.get.trigger) {
      const trigger: string = this.getTriggerForRequest(routeMap, request);
      doLog(this.debug, log, 'TRIGGER FOUND:', trigger);
      return this.persistence.trigger(storeName, trigger, request, sortOptions, pageOptions);
    }

    if (routeMap.get.filter && typeof routeMap.get.filter === 'function') {
      const filter: TtFilterCallback<T> = routeMap.get.filter as TtFilterCallback<T>;
      doLog(this.debug, log, 'FILTER FOUND:', filter);
      return this.persistence.filter<T>(storeName, filter, request, pageOptions, sortOptions);
    }

    if (searchOptions) {
      doLog(this.debug, log, 'SEARCH OPTIONS FOUND:', searchOptions);
      return this.persistence.search<T>(storeName, searchOptions, pageOptions, sortOptions);
    }

    if (pageOptions) {
      doLog(this.debug, log, 'PAGE OPTIONS FOUND:', pageOptions);
      return this.persistence.get<T>(storeName, pageOptions, sortOptions) as Observable<T | T[]>;
    }

    doLog(this.debug, log, 'NO SPECIAL OPTIONS, FALLBACK TO DEFAULT');
    const filter: TtPersistenceRouteFilter = routeMap.get.filter as TtPersistenceRouteFilter;
    const primaryKey: string = this.getPrimaryKeyFromUrl(request, storeName, filter);
    const index: string | undefined = this.getIndexForPrimaryKey(filter);
    doLog(this.debug, log, 'DEFAULT FILTER:', filter);
    doLog(this.debug, log, 'INDEX:', index);
    doLog(this.debug, log, 'PRIMARY KEY:', primaryKey);
    return this.persistence.get<T>(storeName,{ primaryKeys: primaryKey, index: index });
  }

  /**
   * Handle a PUT or PATCH request. It is checked for relevant options defined
   * in the routeMap before the data is updated in the associated
   * objectStore(s). If a combiner or preformat function are defined, these are
   * applied before the data is stored.
   */
  private handlePutRequest<T>(request: HttpRequest<T>, routeMap: TtPersistenceRouteMap): Observable<T | T[]> {
    const method: string = request.method.toLowerCase();
    const storeName: string = routeMap[method].storeName ?? routeMap.storeName;
    return this.persistence.get<T>(storeName, this.createPutKeyOptions(request, routeMap)).pipe(
      switchMap((stored: T | T[]) => {
        const joiners: OperatorTT<T>[] = this.createJoinOperators(routeMap, request);
        const ofStored: Observable<T | T[]> = of(stored);
        return ofStored.pipe.call(ofStored, ...joiners).pipe(
          switchMap((joined: T[]) => {
            if (routeMap[method].combiner) {
              return from(this.handleCombiner(request.body, joined, routeMap, request))
                .pipe(map((current) => [current, joined]));
            }
            return of([request.body, joined]);
          }),
          map(([current, joined]) => {
            if (routeMap[method].preformat) {
              const joinOrStore: T | T[] = routeMap[method].combiner ? stored : joined;
              return routeMap[method].preformat(this.injector, current, joinOrStore);
            }
            return !routeMap[method].preformat && !routeMap[method].combiner ? joined : current;
          }),
          switchMap((updated) => this.persistence.put(routeMap.storeName, updated)),
          map((putted: T | T[]) => {
            if (routeMap[method].formatter) {
              return routeMap[method].formatter(this.injector, request, putted) as T | T[];
            }
            return putted;
          }),
        ) as Observable<T | T[]>;
      }),
    );
  }

  /**
   * Handle the POST request. It is checked for relevant options defined in the
   * routeMap before the data is stored in the associated objectStore(s). If a
   * combiner or preformat function are defined, these are applied before the
   * data is stored.
   */
  private handlePostRequest<T>(request: HttpRequest<T>, routeMap: TtPersistenceRouteMap): Observable<T | T[]> {
    const payload$: Observable<T> = of(request.body);
    const joiners: OperatorTT<T>[] = this.createJoinOperators(routeMap, request);
    return payload$.pipe.call(payload$, ...joiners).pipe(
      switchMap((joined: T[]) => {
        if (routeMap.post.combiner) {
          return from(this.handleCombiner(request.body, joined, routeMap, request))
            .pipe(map((current) => [current, joined]));
        }
        return of([request.body, joined]);
      }),
      map(([current, joined]) => {
        if (routeMap.post.preformat) {
          return routeMap.post.preformat(this.injector, current, joined);
        }
        return !routeMap.post.preformat && !routeMap.post.combiner ? joined : current;
      }),
      switchMap((updated) => this.persistence.post(routeMap.storeName, updated)),
      map((putted: T | T[]) => {
        if (routeMap.post.formatter) {
          return routeMap.post.formatter(this.injector, request, putted) as T | T[];
        }
        return putted;
      }),
    ) as Observable<T | T[]>;
  }

  /**
   * Handle the DELETE request. Cascade options are checked, with or without
   * whitelist. The returned value is formatted if a formatter function is
   * supplied.
   */
  private handleDeleteRequest<T>(request: HttpRequest<T>, routeMap: TtPersistenceRouteMap): Observable<T> {
    const storeName: string = routeMap.delete.storeName ?? routeMap.storeName;
    const filter: TtPersistenceRouteFilter = routeMap.delete.filter;
    let primaryKey: string = this.getPrimaryKeyFromUrl(request, storeName, filter);
    const index: string | undefined = this.getIndexForPrimaryKey(filter);
    const initial$: Observable<T> = routeMap.delete.formatter || routeMap.delete.filter?.property
      ? this.persistence.get<T>(storeName,{ primaryKeys: primaryKey, index: index }) as Observable<T>
      : of(null);

    return initial$.pipe(
      switchMap((result) => {
        if (routeMap.delete.filter?.property) {
          // If the filter property is defined, the primary key to delete are
          // different. Using the options for the store to get the right id.
          const options: TtPersistenceOptions = this.databaseService.optionsMap.get(storeName);
          if (!options || !options.primaryKey) {
            // If somehow there are no settings or primary key, yeet.
            return throwError(() => new NoPrimaryKeyInSettingsError(storeName));
          }
          primaryKey = result[options.primaryKey] as string;
          if (!primaryKey) {
            // If the primary key is empty, yeet.
            return throwError(() => new NoPrimaryKeyInObjectError(storeName, options.primaryKey));
          }
        }
        return this.persistence.delete(storeName, primaryKey).pipe(
          map((deleted) => {
            return routeMap.delete.formatter ? routeMap.delete.formatter(this.injector, request, result) : deleted;
          }),
        );
      }),
    );
  }

  /**
   * Create the RetrieveByKey options object based on the request and routeMap
   * specifications.
   */
  private createPutKeyOptions<T>(request: HttpRequest<T>, routeMap: TtPersistenceRouteMap): RetrieveByKeyOptions {
    const storeName: string = routeMap.put.storeName ?? routeMap.storeName;
    const filter: TtPersistenceRouteFilter = routeMap.put.filter;
    const primaryKey: string = this.getPrimaryKeyFromUrl(request, storeName, filter);
    const index: string | undefined = this.getIndexForPrimaryKey(filter);
    const options: RetrieveByKeyOptions = { primaryKeys: primaryKey };
    if (index) {
      options.index = index;
    }
    return options;
  }

  /**
   * Extract the primary key value from the url with parameters, which can be
   * a UUID or any other value if a matcher function is present. If no value is
   * found, an error is thrown instead.
   */
  private getPrimaryKeyFromUrl<T>(
    request: HttpRequest<T>,
    storeName: string,
    filter?: TtPersistenceRouteFilter,
  ): string {
    const primaryKey: string = filter?.matcher
      ? filter.matcher(request.urlWithParams)
      : this.databaseService.extractPrimaryKey(request.urlWithParams, filter?.index);

    if (!primaryKey) {
      throw new NoPrimaryKeyInUrlError(request.method, storeName, request.urlWithParams);
    }

    return primaryKey;
  }

  /**
   * Get the index that should be referenced when accessing an objectStore,
   * based on the property and primaryKey properties in the filter object, or
   * return undefined if no property is set.
   */
  private getIndexForPrimaryKey(filter?: TtPersistenceRouteFilter): string | undefined {
    if (!filter?.property) {
      return undefined;
    }

    return filter.primaryKey ? `${filter.property}.${this.databaseService.idKey}` : filter.property;
  }

  /**
   * Replace the given route's UUIDs with `{{uuid}}` to allow for matching of
   * non-specific routesMap and remove any http(s) prefixes.
   */
  private cleanRoute(route: string): string {
    return route.replace(this.uuidRegExp, '{{uuid}}')
      .replace('http://', '')
      .replace('https://', '');
  }

  /**
   * Traverse the route mapping settings defined in the config model. If no
   * formatter is found but one of the mappings has format set to true, a hard
   * block is thrown.
   */
  private parseConfigMapping(config: TtPersistenceConfigModel): void {
    let formatter: boolean = !!config.formatter;

    for (const mapper of config.mapping) {
      this.mapRoute(mapper);
      this.handleRequestOptions(mapper.get?.params);
      this.toggleRoute(this.cleanRoute(mapper.url), mapper.skip ?? false, undefined, true);
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (!mapper[method]) {
          continue;
        }

        this.toggleRoute(this.cleanRoute(mapper.url), mapper[method].skip ?? false, method, true);
      }

      if (mapper.get?.format && !mapper.get?.formatter && !formatter) {
        throw new TtPersistenceFormatterMissingError(mapper.url);
      }
    }
  }

  /**
   * Parse the route map config parameter map if it is defined and update the
   * in-memory maps.
   */
  private handleRequestOptions(options?: Map<string, TtPersistenceRequestOption>): void {
    if (!options) {
      return;
    }

    for (const [value, option] of options.entries()) {
      this.setRequestOption(value, option);
    }
  }

  /**
   * Generic parser for the various parameter option types.
   */
  private matchParameters<T, Y>(
    request: HttpRequest<T>,
    method: ParamMatcher<Y>,
  ): Y | undefined {
    const params: HttpParams = request.params;
    let options: Y | undefined;

    for (const [param, type] of this.paramOptionMap.entries()) {
      if (!params.has(param)) {
        continue;
      }

      options = options || {} as Y;
      options = method.call(null, options, params, param, type);
    }

    return Object.keys(options ?? {}).length ? options : undefined;
  }

  /**
   * Match sorting parameters specifically.
   */
  private matchSortingParameters(params: HttpParams): RetrieveBySortingOptions | undefined {
    let options: RetrieveBySortingOptions | undefined;
    const sorting: (value: string) => 'asc' | 'desc' = (value: string): 'asc' | 'desc' => {
      return String(value).toLowerCase().includes('desc') ? 'desc' : 'asc';
    };

    for (const [param, type] of this.paramOptionMap.entries()) {
      if (!params.has(param)) {
        continue;
      }

      options = options || {} as RetrieveBySortingOptions;
      switch (type) {
        case TtPersistenceRequestOption.SORTING: {
          options['direction'] = sorting(params.get(param) as string);
          break;
        }
        case TtPersistenceRequestOption.SORT_COLUMN:
          options['column'] = params.get(param) as string;
          break;
        case TtPersistenceRequestOption.SORT_COLUMN_IN_PARAM: {
          options['column'] = this.extractColumnFromParam(param);
          options['direction'] = sorting(params.get(param) as string);
          break;
        }
        default:
          break;
      }
    }

    return Object.keys(options ?? {}).length ? options : undefined;
  }

  /**
   * Match the parameter type to one of the pagination types and return the
   * extended object.
   */
  private matchPaginationOption(
    options: RetrieveByPageOptions,
    params: HttpParams,
    param: string,
    type: TtPersistenceRequestOption,
  ): RetrieveByPageOptions {
    switch (type) {
      case TtPersistenceRequestOption.PAGINATION:
        if (options.page !== undefined || options.pageSize !== undefined) {
          break;
        }
        options.pagination = params.get(param) === 'true';
        break;
      case TtPersistenceRequestOption.PAGE:
        options.page = parseInt(params.get(param) as string, 10);
        options.pagination = true;
        break;
      case TtPersistenceRequestOption.PAGE_SIZE:
        options.pageSize = parseInt(params.get(param) as string, 10);
        options.pagination = true;
        break;
    }

    return options;
  }

  /**
   * Match the parameters to one of the search related options and return the
   * extended object.
   */
  private matchSearchOption(
    options: RetrieveBySearchOptions,
    params: HttpParams,
    param: string,
    type: TtPersistenceRequestOption,
  ): RetrieveBySearchOptions {
    switch (type) {
      case TtPersistenceRequestOption.SEARCH_TERM:
        options.term = params.get(param) as string;
        break;
      case TtPersistenceRequestOption.SEARCH_INDEX:
        options.index = params.get(param) as string;
        break;
    }

    return options;
  }

  /**
   * Using the RouteMap, if multiple triggers are present, find the trigger that
   * matches the UUIDs and/or HttpParams in the request.
   */
  //eslint-disable-next-line complexity,max-lines-per-function
  private getTriggerForRequest<T>(routeMap: TtPersistenceRouteMap, request: HttpRequest<T>): string {
    const method: string = request.method.toLowerCase();
    if (!Array.isArray(routeMap[method].trigger)) {
      return routeMap[method].trigger;
    }

    let name: string;
    const triggerMap: Map<string, PersistenceOptionsTrigger> = this.databaseService.triggerMap
      .get(routeMap.storeName) ?? new Map();
    const triggers: PersistenceOptionsTrigger[] = [...triggerMap.values()]
      .sort((a, b) => simpleCompare(a.rules.length, b.rules.length, false));

    for (const trigger of triggers) {
      let hasParams: boolean;
      let hasUuids: boolean;
      for (const rule of trigger.rules) {
        if (hasParams === false || hasUuids === false) {
          break;
        }

        if (!('param' in rule)) {
          hasUuids = this.databaseService.extractPrimaryKey(request.url, rule.index, true) !== '';
          continue;
        }

        hasParams = request.params.has(rule.param) || 'params' in rule && request.params.has(rule.params);
        if (rule.unique && hasParams) {
          name = trigger.name;
          break;
        }
      }

      if (hasParams !== false && hasUuids !== false || name !== undefined) {
        name = trigger.name;
        break;
      }
    }

    if (!name) {
      throw new TriggerNotFoundError(routeMap.storeName, routeMap.get.trigger[0]);
    }

    return name;
  }

  /**
   * If a request should be formatted and a formatter is found, the formatter is
   * applied to the returned result. If formatting is enabled but no formatter
   * is found, an error is thrown.
   */
  private handleFormatter<T>(
    result$: Observable<T | T[]>,
    routeMap: TtPersistenceRouteMap,
    request: HttpRequest<T>,
    type: 'formatter' | 'preformat' = 'formatter',
  ): Observable<T | T[]> {
    const formatter: TtPersistenceFormatter | undefined = this.getFormatter(routeMap, request, type);
    if (formatter) {
      return result$.pipe(map((results) => formatter(this.injector, request, results) as T[]));
    }

    return result$;
  }

  /**
   * Combine two streams of data, where payload can be the PUT or PATCH request
   * data that is sent, or one of the joining/combining steps in-between, and
   * the stored data can be the actually currently stored data, or the next step
   * of the chain ('current' combiner function).
   * Returns the mapped data via the combiner function, or the payload stream.
   */
  private handleCombiner<T>(
    payload: T | T[],
    stored: T | T[],
    routeMap: TtPersistenceRouteMap,
    request: HttpRequest<T>,
  ): Promise<T | T[]> {
    const options: TtPersistenceOptions = this.databaseService.optionsMap.get(routeMap.storeName);
    const combiner: TtPersistenceCombiner = this.getFormatter(routeMap, request, 'combiner');
    if (!combiner || !options) {
      return Promise.resolve(payload);
    }

    const payloads: T[] = asArray(payload);
    const storeds: T[] = asArray(stored);
    const mapped: Promise<T>[] = payloads.map((item, index) => {
      const primaryKey: string | number = item[options.primaryKey];
      const matching: T = storeds.find((toMatch) => !!primaryKey && toMatch[options.primaryKey] === primaryKey) as T;
      return combiner(this.injector, item, matching ?? storeds[index]) as Promise<T>;
    });

    if (!Array.isArray(payload)) {
      return mapped[0];
    }

    return Promise.all(mapped);
  }

  /**
   * If the RouteMap has joining definitions, these are applied here.
   */
  private handleJoiner<T>(
    result$: Observable<T | T[]>,
    routeMap: TtPersistenceRouteMap,
    request: HttpRequest<T>,
  ): Observable<T | T[]> {
    const method: string = request.method.toLowerCase();
    if (!routeMap[method]?.joiner?.length) {
      return result$;
    }

    const mergeMaps: OperatorTT<T>[] = this.createJoinOperators(routeMap, request);
    return result$.pipe.call(result$, ...mergeMaps) as Observable<T | T[]>;
  }

  /**
   * Create the array of mergeMaps by using the joiners in the RouteMap, if
   * available.
   */
  private createJoinOperators<T>(
    routeMap: TtPersistenceRouteMap,
    request: HttpRequest<T>,
  ): OperatorTT<T>[] {
    const method: string = request.method.toLowerCase();
    if (!routeMap[method]?.joiner?.length) {
      return [];
    }

    return routeMap[method].joiner.map((join) => this.createJoinerMergeMap(join, request));
  }

  /**
   * Convert the joiners to a list of data retrieval observables that merge the
   * retrieved content according to the join options. The initial results are
   * mapped as an array by default, then converted to one or more mergeMaps,
   * before returning the initial object(s) with the added joined data.
   */
  private createJoinerMergeMap<T>(
    joiner: TtPersistenceJoiner,
    request: HttpRequest<T>,
  ): OperatorTT<T> {
    return mergeMap((initial: T) => {
      const initials: T[] = asArray(initial) as T[];

      const options: [T, RetrieveByKeyOptions][] = initials
        .map((result) => this.createJoinerRetrieveOptions(result, joiner));

      const [firstItem, firstOption] = options[0];
      const first: Observable<T[]> = this.persistence.get(joiner.storeName, firstOption).pipe(
        map((join: Object) => (joiner.formatter ? joiner.formatter(this.injector, request, join) : join)),
        map((join: Object) => ([this.createJoinedObject(firstItem, join, joiner)])),
      );

      const rest: OperatorTT<T>[] = options.slice(1)
        .map(([item, option]) => mergeMap((results: T[]) => this.persistence.get(joiner.storeName, option).pipe(
          map((join: Object) => (joiner.formatter ? joiner.formatter(this.injector, request, join) : join)),
          map((join: Object ) => {
            results.push(this.createJoinedObject(item, join, joiner));
            return results;
          }),
        )));

      return first.pipe.call(first, ...rest).pipe(
        map((results) => (Array.isArray(initial) ? results : results[0])),
      ) as Observable<T | T[]>;
    });
  }

  /**
   * Create {@see RetrieveByKeyOptions} using the result and the defined joiner.
   */
  private createJoinerRetrieveOptions<T>(result: T, joiner: TtPersistenceJoiner): [T, RetrieveByKeyOptions] {
    const persistenceOptions: TtPersistenceOptions = this.databaseService.optionsMap.get(joiner.storeName);
    const primaryKey: string = persistenceOptions?.primaryKey as string;
    if (!primaryKey) {
      throw new NoPrimaryKeyInSettingsError(joiner.storeName);
    }

    const options: RetrieveByKeyOptions = {
      primaryKeys: this.databaseService.extractPrimaryKey(result[joiner.property ?? primaryKey]),
    };

    if (joiner.index) {
      options.index = joiner.index
        ? joiner.primaryKey
          ? `${joiner.index}.${this.databaseService.idKey}`
          : joiner.index
        : undefined;
    }

    return [result, options];
  }

  /**
   * Join results with the toJoin object according to the joiner settings.
   */
  private createJoinedObject<T>(result: T, toJoin: Object, joiner?: TtPersistenceJoiner): T {
    if (joiner?.joinOn) {
      return {
        ...result,
        [joiner.joinOn]: toJoin,
      };
    }
    return {
      ...result,
      ...toJoin,
    };
  }

  /**
   * Get the formatter or combiner function for the request method in the
   * routeMap, if it exists. Throws an error for GET requests that have
   * formatting enabled but no formatter provided.
   */
  private getFormatter<T>(
    routeMap: TtPersistenceRouteMap,
    request: HttpRequest<T>,
    type: 'formatter' | 'preformat' | 'combiner',
  ): TtPersistenceFormatter | TtPersistenceCombiner | undefined {
    const method: string = request.method.toLowerCase();
    const options: Object = routeMap[method];
    let formatter: TtPersistenceFormatter | undefined = options && options[type];

    if (method === 'get') {
      formatter = formatter ?? this.config.formatter;
      if (routeMap.get.format === true && !formatter) {
        throw new TtPersistenceFormatterMissingError(routeMap.url);
      }
    }

    return formatter;
  }

  /**
   * Extract bracketed column values from the parameter and return the columns
   * as a dot-notated path -- `my.nested.column` -- or return the param as-is
   * if no brackets are found.
   */
  private extractColumnFromParam(param: string): string {
    if (!param.includes('[')) {
      return param;
    }

    return param.split('[')
      .slice(1)
      .map((item) => item.replace(']', ''))
      .join('.');
  }

  /**
   * Setup and update the various in-memory and localStorage states to determine
   * the use and application of the interceptor.
   */
  private setupStates(): void {
    const intercept: string | null = this.databaseService.local.getItem(this.interceptorKey);
    const setIntercept: boolean = intercept === null ? this.config.enabled : intercept === 'true';
    this.toggleState(setIntercept);

    const skip: string | null = this.databaseService.local.getItem(this.skipKey);
    const setSkip: boolean = skip === null ? !!this.config.authenticator : skip === 'true';
    this.toggleSkipAuth(setSkip);

    const authenticated: string | null = this.databaseService.local.getItem(this.authKey);
    const setAuth: boolean = authenticated === null ? false : authenticated === 'true';
    this.toggleAuthenticated(setAuth);

    const seeded: string | null = this.databaseService.local.getItem(this.seedKey);
    const setSeeded: boolean = authenticated === null ? false : seeded === 'true';
    this.toggleSeeded(setSeeded);
  }

  /**
   * Setup all route states that are stored and overwrite any states set from the
   * config file with the stored state.
   * @private
   */
  private setupRouteStates(): void {
    const states: string | null = this.databaseService.local.getItem(this.routeKey);
    const parsedStates: TtPersistenceRouteState[] = states ? JSON.parse(states) : [];

    for (const status of parsedStates) {
      const key: string = status.route + (status.method ? `.${status.method}` : '');
      const existing: TtPersistenceRouteState = this.routeStateMap.get(key);
      if (existing) {
        existing.skip = status.skip ?? existing.skip;
      }
      this.routeStateMap.set(key, existing ?? status);
    }

    const toArray: TtPersistenceRouteState[] = [...this.routeStateMap.values()];
    const toString: string = JSON.stringify(toArray);
    this.routeStates$.next(toArray);
    this.databaseService.local.setItem(this.routeKey, toString);
  }
}
