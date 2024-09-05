# TtPersistenceStateService
This service acts as a gateway between the TtPersistenceInterceptor and the
TtPersistenceService, with some handy features and toggles to facilitate the
use of the Persistence services.

When interacting with the TtPersistenceService, it is recommended to use this
StateService, instead of manually calling the various functions. To use it
manually, simply fake an HttpRequest!

### Available methods
For ease of use, the StateService provides various methods, toggles and states
to fine-tune the usage of the service, interceptor and logic.

#### `state(): boolean`
Getter for the state of intercepting data using GeneratorPersistence.

#### `skip(): boolean`
Getter for the usage of login credentials. Auth skipping is always false if the
data interception is disabled.

#### `authenticated(): boolean`
Getter for the called state of the authenticator function in the
PersistenceConfig, if it exists.

#### `seeded(): boolean`
Getter for the called state of the seeder function from the options.

#### `seeding$(): Observable<boolean>`
Getter that returns the current seeding state. Since the seeding function can
be called again, this observable can be used as a loading indicator. This
observable is also used by the interceptor to prevent calls from being made
while the IndexedDB is shut down when seeding.

#### `toggleState(state?: boolean): void`
Toggle the usage of persistent generated data.

#### `toggleSkipAuth(state?: boolean): void`
Toggle the usage of fake login credentials.

#### `toggleAuthenticated(state?: boolean): void`
Toggle the stored authenticated state. If set to false, the next page reload
will re-initialize the authenticator function from the config.

#### `toggleSeeded(state?: boolean): void`
Toggle the stored seeded state. If set to false, the next page reload will run
the seeder factory function.

#### `async authenticate(): Promise<boolean>`
Async check to see if the authenticator function in the config is available and
has been called. This method will call the authenticator function and update
the in-memory and localStorage keys. The results are usually available after a
route-change, but definitely after a page reload.

#### `async seed(): Promise<boolean>`
Async check to see if a seeder function is available in the config and has been
called. This method will call the seeder function and persist the generated
data, after which the in-memory and localStorage keys are updated. Similar to
the authenticate function, the results should be visible after a route-change.

#### `async uninstall(): Promise<void>`
Complete removes the database and all localStorage items used by the services.

#### `mapRoute(routeMap: TtPersistenceRouteMap): void`
Add a custom RouteMap object to the in-memory stack, outside the Module config
Can be used for testing purposes or for creating a specific localised function.

#### `unmapRoute(route: string): void`
Remove a (custom) route from the in-memory stack.

#### `setRequestOption(value: string, option: TtPersistenceRequestOption): void`
Add a custom HttpParam key and its corresponding RequestOption to the in-memory
stack. Like a custom route, this method can be used to create a specific and/or
testing scenario.

#### `unsetRequestOption(value: string): void`
Remove a (custom) HttpParam key and its relations from the in-memory stack.

#### `getStoreName(route: string): string | undefined`
Returns the objectStore name for the given route, if it exists. Can be used to
retrieve data manually via the PersistenceService, or to manually get the data
from the IndexedDB if so desired.

#### `hasRoute(route: string): boolean`
Determine if the given route is available in the routesMap map.

#### `extractPrimaryKey(route: string, index: number = 0, exact?: boolean): string`
Extract a UUID from the given route. An index can be provided, in case more than
one UUID is found in the route. If the exact boolean toggle is given, an empty
string will be returned if no UUID was found at the given index.

#### `handleRequest<T>(request: HttpRequest<T>): Observable<T | T[]> | null`
This method handles HttpRequests using the Module config or any custom routes
that have been set afterwards. This method is used by the PersistenceInterceptor
to handle its requests, as such, a custom HttpRequest can be made to simulate
that functionality.
