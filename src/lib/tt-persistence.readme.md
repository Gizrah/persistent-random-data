# TtPersistence
This readme contains an overview of the usage of the TtPersistence module and
how to set it up. For more in-depth information, each of the various publicly
accessible services and interfaces is well documented.

- - -
Table of Content:
<!-- TOC -->
* [TtPersistence](#ttpersistence)
* [Module Config](#module-config)
* [Route Mapping with `TtPersistenceRouteMap`](#route-mapping-with-ttpersistenceroutemap)
      * [Example: Basic RouteMap](#example--basic-routemap)
  * [Recurring properties](#recurring-properties)
    * [StoreName](#storename)
    * [Formatter](#formatter)
      * [Example: Formatter function](#example--formatter-function)
    * [Joiner](#joiner)
      * [Example: Joining data to a GET request](#example--joining-data-to-a-get-request)
    * [Combiner](#combiner)
      * [Example: Combining joiner data with stored data](#example--combining-joiner-data-with-stored-data)
    * [Preformat](#preformat)
    * [Filter: TtPersistenceRouteFilter](#filter--ttpersistenceroutefilter)
      * [Example: Filter: UUID is nested object's primary key](#example--filter--uuid-is-nested-objects-primary-key)
      * [Example: Filter: More than one UUID in the url](#example--filter--more-than-one-uuid-in-the-url)
      * [Example: Filter: Value in URL is not a UUID.](#example--filter--value-in-url-is-not-a-uuid)
  * [Method specific properties: `TtPersistenceRouteGet`](#method-specific-properties--ttpersistencerouteget)
    * [StoreName](#storename-1)
    * [Format](#format)
    * [Formatter](#formatter-1)
    * [Params](#params)
      * [Example: Creating a parameter map](#example--creating-a-parameter-map)
    * [Filter](#filter)
      * [Example: Filter function](#example--filter-function)
    * [Trigger](#trigger)
    * [Joiner](#joiner-1)
  * [Method specific properties: `TtPersistenceRoutePost`](#method-specific-properties--ttpersistenceroutepost)
    * [StoreName](#storename-2)
    * [Joiner](#joiner-2)
    * [Combiner](#combiner-1)
    * [Preformat](#preformat-1)
    * [Formatter](#formatter-2)
  * [Method specific properties: `TtPersistenceRoutePut`](#method-specific-properties--ttpersistencerouteput)
    * [StoreName](#storename-3)
    * [Joiner](#joiner-3)
    * [Combiner](#combiner-2)
    * [Preformat](#preformat-2)
    * [Formatter](#formatter-3)
    * [Filter](#filter-1)
  * [Method specific properties: `TtPersistenceRouteDelete`](#method-specific-properties--ttpersistenceroutedelete)
    * [StoreName](#storename-4)
    * [Formatter](#formatter-4)
    * [Filter](#filter-2)
* [Default Formatting](#default-formatting)
      * [Example](#example)
* [Faking Authentication](#faking-authentication)
      * [Example](#example-1)
    * [Using the fake authentication](#using-the-fake-authentication)
      * [Example](#example-2)
* [Triggers](#triggers)
      * [Example](#example-3)
* [Generating Random Data](#generating-random-data)
* [Extracting Data](#extracting-data)
* [Seeding the Database](#seeding-the-database)
      * [Example](#example-4)
* [No-operation (noop) mode](#no-operation--noop--mode)
<!-- TOC -->

- - -

# Module Config
The configuration for the TtPersistenceModule has you set up the various routes
to intercept, a seeder function, an authenticator function and a default
formatter function. Except the route mapping, each of the others are optional
functions. For more in-depth explanations, refer to the interface documentation.

```typescript
interface TtPersistenceConfig {
  // If set to true, will default to using the interceptor.
  enabled: boolean;
  // Mapping of routes to objectStores with specifications for each route.
  mapping: TtPersistenceRouteMap[];
  // Seeder function which populates the IndexedDB.
  seeder?: (persistence: TtPersistenceService, extractor: Extractor, generator: Generator) => Promise<void>;
  // Authenticator function that sets the fake authentication details.
  authenticator?: (injector: Injector) => Promise<void>;
  // General formatter function that is used by each mapped route that should be
  // formatted and has no custom formatter.
  formatter?: TtPersistenceFormatter;
}
```

The `TtPersistenceConfig` interface is well documented, but having an example is
always easier. Read on for a more in-depth example of each property, except the
`enabled` boolean toggle. That one *should* be obvious, but in any case, it
enables the interceptor by default. That means that on application start, the
seeder and authenticator functions are called if they have not yet been.

- - -

# Route Mapping with `TtPersistenceRouteMap`
Each route and each method for said route should be defined for the interceptor
to handle properly. As such, the `TtPersistenceRouteMap` object has extensive
options to determine how each call should be handled. Each method has its own
set of options to reflect the difference in how the data should be handled,
since a POST and GET action differ quite vastly in how the data should be
handled. The `TtPersistenceRouteMap` interface has abridged documentation for
each of the methods. Each of the method interfaces has extended documentation.

```typescript
interface TtPersistenceRouteMap {
  // The url for this mapping.
  url: string;
  // The objectStore name the data should be retrieved from.
  storeName: string;
  // GET method options.
  get?: TtPersistenceRouteGet;
  // POST method options.
  post?: TtPersistenceRoutePost;
  // PUT and PATCH method options.
  put?: TtPersistenceRoutePut;
  // DELETE method options.
  delete?: TtPersistenceRouteDelete;
}
```

The first thing that should be defined is the `url` for this call. This is the
plain url, without http parameters. These can be handled in several ways, more
on that in the various `TtPersistenceRoute` method interface examples. The next
definition, the `storeName`, refers to which objectStore the various methods
can write, update, read or delete the data. Each of the method options allows
you to overwrite the storeName, in case a method differs vastly.

#### Example: Basic RouteMap
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
}
```

## Recurring properties
Among the four definitions available, there are recurring properties.

### StoreName
Override the default storeName as defined in the `TtPersistenceRouteMap`. This
can be useful if a route GETs a different object than for a PUT or PATCH. Or, if
normal operations adjust a nested part of a bigger object, but doing a DELETE
action would require to also delete the parent object.

### Formatter
An override for the on defined in [Default Formatting](#default-formatting). If
defined, it will be used instead of the default formatter. As always, this
function is called before the data is sent back to the interceptor and can help
shape the stored/retrieved data as it is expected by the intercepted endpoint.

#### Example: Formatter function
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
  get: {
    formatter: (injector: Injector, url: string, output: unknown): unknown => {
        if (Array.isArray(output)) {
            return output[0];
        }
        return output;
    },
  },
}
```

### Joiner
Joiners allow retrieval of data from different objectStores and will be
'grafted' on to the original object at a given property name. This can be very
useful when storing or retrieving data expects content that is static and/or
recurring.

```typescript
interface TtPersistenceJoiner {
  // ObjectStore name to get the joining data from.
  storeName: string;
  // Which property in the initial object holds the value to a joining object.
  property: string;
  // If the property value references a nested value in the objectStore, supply
  // a (dot-notated) index to the path.
  index?: string;
  // If the index references a primary key column, set this value to true.
  primaryKey?: boolean;
  // Which property to put the joined object. If unset, appends original object.
  joinOn?: string;
  // Whether to expect and/or always return values as an array. Default false.
  multiple?: boolean;
  // Retrieve the linked data as well as the initial join object? Default false.
  getLinked?: boolean;
  // Optional formatter to format the content of the joining object.
  formatter?: TtPersistenceFormatter;
}
```

The joiner is created to easily get data from other objectStores, without the
need to use the various functions. The `TtPersistenceFormatter` function can be
used to format the results properly after grafting the retrieved data in to the
content as retrieved from the objectStore. In addition, depending on the http
method used, some other functionality can be chained after the joiners.

For more complex data joining, the [Triggers](#triggers) are available.

#### Example: Joining data to a GET request
```typescript
// Person storage example:
interface Person {
  firstName: string;
  lastName: sting;
  emailAddress: string;
}
// Email storage example:
interface Email {
  primary: boolean;
  value: string;
}
// Person as returned to the endpoint:
interface GetPerson {
  firstName: string;
  lastName: string;
  primaryEmailAddress: Email;
}
// RouteMap to GET a person and join the email address:
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
  get: {
    joiner: [{
      // Getting data from the objectStore Email.
      storeName: 'Email',
      // Get the email address currently in the Person object.
      property: 'emailAddress',
      // The email address is stored in the `value` property in the Email store.
      index: 'value',
      // Join the returned data inside the Person object on the new property.
      joinOn: 'primaryEmailAddress',
    }],
  },
}
```

### Combiner
Asynchronous function that is used to combine the payload data with the stored,
or joined, data, that allows for enriching and combining the payload and/or
joined data with content from other objectStores. It is only available for POST
and PUT/PATCH methods. In effect, it's an async function that allows you to just
do whatever before storing/updating content, including updating different
stores.

```typescript
type TtPersistenceCombiner<T = any, K = any> = (injector: Injector, payload: T | K, stored: K) => Promise<any>;
```

The `TtPersistenceCombiner` function parameters give access to the `Injector`,
so any and all injectables can be accessed. The `payload` will always be the
request body, for POST and PUT/PATCH requests. The `stored` variable changes
slightly for POST and PUT/PATCH variants:

- On GET: the **stored content** with the joined data, if set.
- On POST: the **payload data** with the joined data, if set.

#### Example: Combining joiner data with stored data
```typescript
// Person storage example:
interface Person {
  id: string;
  firstName: string;
  lastName: sting;
  organisation: Organisation;
  primaryEmailAddress: Email;
}
// Email storage example:
interface Email {
  id: string;
  primary: boolean;
  value: string;
}
// Organisation storage example:
interface Organisation {
  id: string;
  name: string;
  address: OrganisationAddress;
}
// POST payload, with joined data:
interface PostPerson {
  firstName: string;
  lastName: string;
  emailAddress: string;
  organisationId: string;
  organisation: Organisation;
}
// POST with joiner and combiner:
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/person/{{uuid}}/',
  storeName: 'Person',
  post: {
    joiner: [{
      storeName: 'Organisation',
      property: 'organisationId',
      joinOn: 'organisation',
    }],
    combiner: async (injector: Injector, payload: PostPerson, stored: any): Promise<Person> => {
      const persistence: TtPersistenceService = injector.get(TtPersistenceService);
      const generator: Generator = persistence.generator;
      // Returns an Email object based on the first name and last name for the
      // organisation:
      const email: Email = generateEmailAddress(
        generator,
        payload.firstName,
        payload.lastName,
        payload.organisation.name,
      );
      // Store the new Email object in the objectStore:
      await persistence.post('Email', email);
      // Generate a UUID, but don't keep a cache:
      const uuid: { id: string } = generator.generate(new GenerateUuid({ key: 'id' }), true);
      // Return the expected storage object:
      return {
        ...uuid,
        firstName: payload.firstName,
        lastName: payload.lastName,
        organisation: payload.organisation,
        primaryEmailAddress: email,
      };
    },
  },
}
```

### Preformat
```typescript
type TtPersistenceFormatter<T = any> = (injector: Injector, request: HttpRequest<T> | T, output: any) => any;
```
As a final link in the chain for POST, PATCH and PUT, there is the `preformat`
function available. It is a function similar to the `TtPersistenceFormatter` and
allows you to adjust and/or enrich the data in a non-async function after both
the `TtPersistenceJoiner` and `TtPersistenceCombiner` have been handled, if set.

As such, the `preformat` formatter parameter values are different per method
and defined options:

- The `stored` parameter will always be the request body (POST) or stored
  content (PUT/PATCH), with the joined data grafted on to the object(s).
- With joiners defined, the `request` parameter will be the request body;
- With a combiner function defined, the `request` parameter will be the function
  return value.

### Filter: TtPersistenceRouteFilter
The `TtPersistenceRouteFilter` object allows for a more granular approach:
- If the UUID in the url refers to a nested primary key, instead of the primary
  key index of the currently defined objectStore;
- If there is more than one UUID in the url;
- If the value to use in the url is not a UUID.

```typescript
interface TtPersistenceRouteFilter {
  // Key (or dot.noted.path) of which property matches the UUID in the url.
  property?: string;
  // If the property value references an object, setting primaryKey to true will
  // reference and match the primary key in the object to the primary key column
  // in the objectStore.
  primaryKey?: boolean;
  // Which index should be used instead of the default 0.
  index?: number;
  // Function to extract the required index value.
  matcher?: (url: string) => string;
}
```

#### Example: Filter: UUID is nested object's primary key
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/people',
  storeName: 'Person',
  get: {
    // Filter will attempt to find all objects in Person where
    // Person.location[primaryKey] is the give UUID.
    filter: {
      property: 'location',
      primaryKey: true,
      index: 0,
    },
  },
}
```

#### Example: Filter: More than one UUID in the url
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/people/{{uuid}}',
  storeName: 'Person',
  get: {
    // Will get the person with UUID at index 1.
    filter: {
      index: 1,
    },
  },
}
```

#### Example: Filter: Value in URL is not a UUID.
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/user/some@email.com',
  storeName: 'Person',
  get: {
    // Will match the matcher function result to the Person.email property in
    // the objectStore.
    filter: {
      property: 'email',
      matcher: (url: string): string => {
        return url.replace('my-domain.com/api/v8/user/', '');
      },
    },
  },
}
```

- - -

## Method specific properties: `TtPersistenceRouteGet`
The file: [tt-persistence-route-get.interface.ts](interfaces/tt-persistence-route-get.interface.ts)

The GET method object facilitates multiple ways to retrieve data from one or
more objectStores.

```typescript
interface TtPersistenceRouteGet {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Whether formatting is enabled or not for this route.
  format?: boolean;
  // Custom formatter. If not set, will fall back to the config formatter.
  formatter?: TtPersistenceFormatter;
  // A Map with HttpParams and the corresponding RequestOptions.
  params?: Map<string, TtPersistenceRequestOption>;
  // Custom filter function, or reference to UUID in route.
  filter?: TtPersistenceRouteFilterFunction | TtPersistenceRouteFilter;
  // Trigger name(s), set in the PersistenceOptions for the objectStore.
  trigger?: string | string[];
  // Join data from one or more objectStores.
  joiner?: TtPersistenceJoiner[];
}
```

### StoreName
See [StoreName](#storename).

### Format
Whether to use the default formatter or not. Will be ignored if not set to true
or false. If set to true and no default formatter is defined nor an overriding
formatter function, an error will be thrown.

### Formatter
See [Formatter](#formatter), or [Default Formatting](#default-formatting).

### Params
The `params` map is used to define `HttpParams` and their corresponding
functionality in the services as defined by the `TtPersistenceRequestOption`.
These are mainly used to define default pagination and sorting for the route.

#### Example: Creating a parameter map
```typescript
const paramMap: Map<string, TtPersistenceRequestOption> = new Map();
// Pagination current page parameter.
paramMap.set('page', TtPersistenceRequestOption.PAGE);
// Pagination amount of items per page parameter.
paramMap.set('itemsPerPage', TtPersistenceRequestOption.PAGE_SIZE);
// Sorting parameter, but the column on which to sort is defined in the param
// itself. The param's value will be checked to define the sort order.
paramMap.set('sort[name]', TtPersistenceRequestOption.SORT_COLUMN_IN_PARAM);

const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
  get: {
    format: true,
    params: paramMap,
  },
}
```

### Filter
The `filter` property can be defined in one of two ways: as an object, see
[Filter: TtPersistenceRouteFilter](#filter--ttpersistenceroutefilter), or a
function that works similar to `Array.filter`,
the `TtPersistenceRouteFilterFunction`.

#### Example: Filter function
```typescript
const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
  get: {
    format: true,
    // Filter function:
    filter: (item: Object, request: HttpRequest<Object>): boolean => {
      return item.hasOwnProperty('name') && item.name === request.params.get('name');
    },
  },
}
```

### Trigger
See [Triggers](#triggers).

**NOTE**: Triggers override any other combination of `params`, `filter` and/or
`joiners`.

### Joiner
See [Joiners](#joiner).

- - -

## Method specific properties: `TtPersistenceRoutePost`
The file: [tt-persistence-route-post.interface.ts](interfaces/tt-persistence-route-post.interface.ts)

The POST method object facilitates storing data in an objectStore.

```typescript
interface TtPersistenceRoutePost {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Join data from one or more objectStores before storage.
  joiner?: TtPersistenceJoiner[];
  // Adjust the current (payload) data before sending it to the formatter.
  combiner?: TtPersistenceCombiner;
  // Adjust the data before storing it in the objectStore.
  preformat?: TtPersistenceFormatter;
  // Alter the newly stored data before returning it to the call.
  formatter?: TtPersistenceFormatter;
}
```

### StoreName
See [StoreName](#storename).

### Joiner
See [Joiner](#joiner).

### Combiner
See [Combiner](#combiner).

### Preformat
See [Preformat](#preformat).

### Formatter
See [Formatter](#formatter).

- - -

## Method specific properties: `TtPersistenceRoutePut`
The file: [tt-persistence-route-put.interface.ts](interfaces/tt-persistence-route-put.interface.ts)

The PUT method, used to replace objects at the same index, is functionally the
same as the PATCH method internally, hence that `patch` and `put` both use the
same interface.

```typescript
interface TtPersistenceRoutePut {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Join data from one or more objectStores before storage.
  joiner?: TtPersistenceJoiner[];
  // Change the payload data (with joined data) before the formatter.
  combiner?: TtPersistenceCombiner;
  // Pre-format the `combine` result or payload data with the stored (if no
  // joiners or both `joiner` and `combine` are defined) or joined (if only
  // joiners are defined) data.
  preformat?: TtPersistenceFormatter;
  // Alter the returned value.
  formatter?: TtPersistenceFormatter;
  // Which UUID in the route should be used as primary key, if not the first.
  filter?: TtPersistenceRouteFilter;
}
```

### StoreName
See [StoreName](#storename).

### Joiner
See [Joiner](#joiner).

### Combiner
See [Combiner](#combiner).

### Preformat
See [Preformat](#preformat).

### Formatter
See [Formatter](#formatter).

### Filter
See [Filter: TtPersistenceRouteFilter](#filter--ttpersistenceroutefilter).

- - -

## Method specific properties: `TtPersistenceRouteDelete`
The file: [tt-persistence-route-delete.interface.ts](interfaces/tt-persistence-route-delete.interface.ts)

The DELETE method is handled in a similar manner to the other methods, but has
fewer options available. For more information on how deleting data works,
see the documentation at the top of and in the
[TtPersistenceDeleteService](services/tt-persistence-delete.service.ts).

```typescript
interface TtPersistenceRouteDelete {
  // Override the default objectStore name for this request.
  storeName?: string;
  // Alter default DeleteResult reply to something containing the stored value.
  formatter?: TtPersistenceFormatter;
  // Which UUID in the route should be used as primary key, if not the first.
  filter?: TtPersistenceRouteFilter;
}
```

### StoreName
See [StoreName](#storename).

### Formatter
See [Formatter](#formatter).

### Filter
See [Filter: TtPersistenceRouteFilter](#filter--ttpersistenceroutefilter).

- - -

# Default Formatting
Since there usually is overlap in how endpoints expect their data to be
formatted, a default formatter function is a wanted addition. As such, the
`TtPersistenceFormatter` comes to help in need.

```typescript
type TtPersistenceFormatter<T = any> = (injector: Injector, request: HttpRequest<T> | T, output: any) => any;
```

Since the formatter comes with the `Injector`, you have access to all other
injectables in the application. Since this function is not `async`, this is
mainly used to manipulate the data via various means, or inject static data
available in the application.

The `HttpRequest` is available in its entirety as forwarded by the interceptor.
This allows access to all parameters and headers, the complete url, et ce tera,
so you have full access to whatever extra data you need before returning the
content of the output.

The `output` changes, depending on the http method:
- On GET: The objectStore content, optionally with additionally joined data (see
  [Joiner](#joiner));
- On POST/PATCH/PUT: The content that was stored in the objectStore after all
  manipulations;
- On DELETE: An array of `TtDeleteResult` items, containing the stats for the
  delete action.

The `TtPersistenceFormatter` function can be used to adjust the results in a
required format, or to simply make sure that the results are always the same,
even if the request output from the database is not what is expected by the
call; e.g. the returned value is an array, but only a single object should be
returned regardless:

#### Example
```typescript
// This function returns a JSON+LD or Hydra object, depending on the output
// being a single object, or an array.
const config: TtPersistenceConfig = {
  enabled: true,
  mapping: [],
  formatter: (injector: Injector, url: string, output: unknown): unknown => {
    const stateService: TtPersistenceStateService = injector.get(TtPersistenceStateService);
    const base: Object = {
      '@context': 'api/contexts/' + stateService.getStoreName(url) ?? 'generated',
      '@id': '/api' + url.split('/api')[1],
    };

    if (Array.isArray(output)) {
      return {
        ...base,
        '@type': stateService.getStoreName(url) ?? 'hydra:Collection',
        'hydra:member': output,
        'hydra:totalItems': output.length,
      };
    }
    return {
      ...base,
      '@type': stateService.getStoreName(url) ?? 'GeneratedContent',
      ...output as Object,
    };
  },
}
```

- - -

# Faking Authentication
Depending on your application, it can be useful to create a default user, or
create several users with different roles for testing certain implementations.
The method should be called after service creation, so the Injector can be used
to get all available services in your application.

#### Example
```typescript
export async function persistenceAuthenticator(injector: Injector): Promise<void> {
  // Some random user object.
  const USER_PROFILE: Object = {
    id: '654321aa-5a55-4444-888a-a123a654321b',
    personId: '123456aa-5a55-4444-888a-a123a123456a',
    firstName: 'Admin',
    lastName: 'User',
    fullName: 'Admin User',
    email: 'some.email@domain.com',
    roles: ['ROLE_ADMIN'],
  };

  // Use a Storage solution to handle some default storage settings, used by the
  // middleware services.
  const storage: Storage = injector.get(Storage);
  await storage.set('accessToken', 'this_is_garbage');
  await storage.set('accessTokenExpiresIn', '2024-01-01T10:00:00.000Z');
  await storage.set('refreshToken', 'more_garbage_values');

  // Persist the newly minted user, by grabbing the service via the Injector.
  const persistence: TtPersistenceService = injector.get(TtPersistenceService);
  await firstValueFrom(persistence.persist(USER_PROFILE, { storeName: 'DefaultUser', primaryKey: 'id' }));
}
```

### Using the fake authentication
If you use a route guard in your application, extend your `canActivate`
function to bypass your required login. It is useful to put the authentication
and/or seeding here as well, so you're sure that it is always seeded and
authenticated when the user changes a route. Make sure to add the Optional
parameter decorator, so no errors are created when the module is in noop mode.

#### Example
```typescript
export class OAuthGuard {
  constructor(@Optional() private persistence: TtPersistenceStateService) {}

  public override async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    // Check if the interceptor is enabled at all.
    if (this.persistence?.skip) {
      // If enabled, first call the authenticator.
      await this.persistence.authenticate();
      // Seed the data if it hasn't been done yet.
      await this.persistence.seed();
      // "authenticate" your user with the data from the authenticator.
      await this.userService.isAuthenticated();
      // Should return true by default, since we're skipping!
      return true;
    }
    // Normal logic.
  }
}
```

- - -

# Triggers
The `trigger` property allows the assignment of one or more triggers to the
GET method. Triggers use both http params and url values to create a specific
combination that triggers the way a call should be handled -- and with what data
-- and will always supersede any of the `filter`, `params` or `joiners` defined
in the route map.

#### Example
```typescript
const trigger: TtPersistenceIndexTrigger = {
  name: 'PersonName',
  rules: [
    // By defining a property and index, a UUID will be extracted, similar to
    // the way the TtPersistenceRouteFilter is defined.
    {
      property: 'location',
      primaryKey: true,
      index: 0,
    },
    // By adding a `param`, the service looks for a parameter instead of a UUID.
    {
      property: 'name',
      // If the parameter is an array, which value should be used?
      index: 0,
      // The HttpParam for a single parameter value.
      param: 'name',
      // The HttpParam for multiple parameter values.
      params: 'name[]',
    }
  ],
}

const map: TtPersistenceRouteMap = {
  url: 'my-domain.com/api/v8/location/{{uuid}}/person',
  storeName: 'Person',
  get: {
    trigger: 'PersonName',
  },
}
```
In this example, when the database creates the objectStore `Person`, a custom
index is added for `"person.location.__pkey__, name"`. Each time the trigger is
triggered, it'll extract the location UUID from the url, as well as the value
for the `name` http parameter. These two values could correspond to a stored
index value. If it's found, an array of items is returned by default, so if only
one item is expected, a formatter function will be handy.

- - -

# Generating Random Data
See the [Generator Readme](generator.readme.md) for extensive information on
generating randomized data.

- - -

# Extracting Data
See the [Extractor Readme](extractor.readme.md) for extensive information on
converting existing data to create Generator objects.

- - -

# Seeding the Database
To populate the database, a seeder function can be defined. This function comes
with the TtPersistenceService, the Extractor and Generator. The Persistence
service will allow you to persist the generated data. The Extractor can be used
to create a `Generatable` object, that can be used in the Generator class.
Please refer to the documentation for both these classes for more information,
but here is a relatively simple example:

#### Example
```typescript
const stores: string[] = ['Person'];

// Simple location generator function.
function generateLocation(generator: Generator): Object {
  const location: GenerateObject = new GenerateObject({
    key: '',
    content: [
      new GenerateUuid({ key: 'id' }),
      new GenerateWord({ key: 'name', minLength: 4, maxLength: 20, capitalize: true }),
    ]
  });

  return generator.generate(location, true) as Object;
}

// Simple person generator function.
function generatePerson(generator: Generator, location: Object): Object {
  // Easy randomized boolean value.
  const isFemale: boolean = generator.yes();
  // Easy access to Faker!
  const firstName: string = generator.faker.name.firstName(isFemale ? 'female' : 'male');
  const lastName: string = generator.faker.name.lastName();
  // Key is '', so the object is returned as-is and not as { [key]: object }.
  const person: GenerateObject = new GenerateObject({
    key: '',
    content: [
      new GenerateUuid({ key: 'id' }),
      new GenerateCustom({ key: 'location', value: location }),
      new GenerateCustom({ key: 'firstName', value: firstName }),
      new GenerateCustom({ key: 'lastName', value: lastName }),
      new GenerateCustom({ key: 'name', value: firstName + ' ' + lastName }),
      new GenerateCustom({ key: 'gender', value: isFemale ? 'FEMALE' : 'MALE' }),
      new GenerateEmail({ key: 'email', firstName: firstName, lastName: lastName }),
      new GeneratePhoneNumber({ key: 'phone' }),
    ],
  });
  // The result is not cached, since we're persisting the result as-is.
  return generator.generate(person, true) as Object;
}

// Seeder function
export async function persistenceSeeder(
  persistence: TtPersistenceService,
  extractor: Extractor,
  generator: Generator,
): Promise<void> {
  // It might be wise to delete or clear existing objectStores before seeding it
  // with new data. Setting the cascade options to 'KEEP', means that the
  // service will not traverse the links to remove the nested objects from any
  // parent object that might have content from the objectStores that will be
  // deleted. Since this is an observale, it's converted to a promise instead.
  await firstValueFrom(persistence.deleteObjectStore(stores, DeleteCascadeOptions.KEEP));
  // These two arrays will be 'persisted'.
  const locations: Object[] = [];
  const people: Object[] = [];

  // First, let's generate 10 locations.
  for (let amount: number = 0; amount < 10; amount++) {
    locations.push(generateLocation(generator));
  }

  // For each location, let's generate between 100 and 300 people.
  for (const location of locations) {
    // Simple RNG between 100 and 300.
    const total: number = generator.rng(100, 300);
    for (let count: number = 0; count < total; count++) {
      const person: Object = generatePerson(generator, location);
      people.push(person);
    }
  }

  // Now persist the generated data and, using some Observable piping converted
  // to Promises, await the results.
  await firstValueFrom(persistence.persist(locations, {
    storeName: 'Location',
    primaryKey: '@id',
  }).pipe(
    mergeMap(() => persistence.persist(people, {
      storeName: 'Person',
      primaryKey: 'id',
      linkedKeys: new Map([
        // Link the location property to the Location objectStore.
        ['location', { storeName: 'Location', primaryKey: 'id' }],
      ]),
      triggers: [
        {
          name: 'PersonName',
          rules: [
            { property: 'location', index: 0 },
            { property: 'name', index: 0, param: 'name', params: 'name[]' },
          ],
        }
      ]
    })),
  ));

  // Data has been seeded!
}
```

# No-operation (noop) mode
Since this module is intended to be used on non-production environments, the
entire module can be set to noop by instantiating the module's `forRoot`
method's second boolean parameter:

```typescript
@NgModule({
  imports: [
    // If set to true, the module is loaded as a noop-module.
    TtPersistenceModule.forRoot(yourConfig, environment.production),
  ],
})
```
This will ensure that the module and its dependencies are not included in the
production bundle. However, this does not apply to any content you have created
yourself, like the `TtPersistenceConfig`.

If you want to exclude all things related to the `TtPersistence` suite, you can
make sure to export your config content depending on the environment variables:

```typescript
const yourConfigConst: TtPersistenceConfig = { /* your config */ };

export const PERSISTENCE_CONFIG: TtPersistenceConfig = environment.production
  ? { enabled: false, mapping: [] } : yourConfigConst;
```
