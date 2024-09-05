# TtPersistenceService
This service provides a generalized approach to manipulate data in the browser's
IndexedDB object storage database. Utilizing the Extractor and Generator, you
can create persistent storage for randomly generated data and create relations
for various nested objects. These relations are then retrieved from their
respective objectStores when accessing data.

### Properties and functions
The TtPersistenceService has several publicly accessible methods that can be
accessed manually:

#### `getCounter(storeName: string): number`
Returns the total number of results for the last GET action done to the given
objectStore name. Should be used immediately in the method that retrieves the
data from the objectStore.

#### `uuidFrom(value: string, index?: number): string`
Get the first UUID match from a string or the original string if no match is
present. If there are multiple UUIDs in the string, supply an index value for
the match you want. Falls back to the first UUID hit it gets if there's no UUID
present at the index.

#### `retrieveByKey(property: string | null, primaryKeys: string | string[]): RetrieveByKeyOptions`
Create a RetrieveByKeyOptions object for the given parameters. Shorthand
function to create objectStore primary key index values without having to import
any other service.

#### `persist(content: Unknown | Unknown[], options: PersistenceOptions): Observable<void>`
Persist data in the service using a combination of LocalStorage and IndexedDB.
See `Persistence` below for more details.

#### `post<T>(storeName: string, content: T | T[], generate?: Generatable): Observable<T | T[]>`
Add data to a specific objectStore. You can add a Generatable for certain
(nested) items to add a UUID or other content that needs to be generated, as
a POST operation would normally do. Returns the added content with generated
values.

#### `put<T>(storeName: string, content: T | T[]): Observable<T | T[]>`
Update data in a specific objectStore. The same process as the `post` method is
used, so relations inside the data is also processed according to the
persistence settings that were determined with the `persist` method. Using the
`put` method requires data to have a primary key set.

#### `get<T>(storeName: string, getOptions: RetrieveByKeyOptions | RetrieveByPageOptions, sortOptions?: RetrieveBySortingOptions): Observable<T | T[]>`
Retrieve data from an objectStore, similarly to how a CRUD operation would. The
data can either be retrieved by using the primary keys used when persisting the
data, or via pagination. If the primary keys contain a UUID, they can be added
as-is, without the need to extract the UUID.
For basic pagination, add the page number and page size when requesting data,
according to either of the two interfaces used by the getOptions parameter.
For basic sorting the `RetrieveBySortingOptions` can be used.

#### `trigger<T>(storeName: string, triggerName: string, request: HttpRequest<T>, sortOptions?: RetrieveBySortingOptions, pageOptions?: RetrieveByPageOptions): Observable<T[]>`
Retrieve data from an objectStore according to a specific PersistenceTrigger.
All (paginated and/or sorted) results are returned based on the trigger content.
See the `PersistenceIndexTrigger`. Triggers have to be setup with the creation
of a database and can not be added when the database is up.

#### `delete(storeName: string, primaryKeys: string | string[], type?: DeleteCascadeOptions): Observable<DeleteResult[]>`
Delete data in an objectStore, using one or more primary keys. The optional type
will be used to determine what will be done with all objectStores that have the
deleted content still nested. It can be overwritten with `null` or `undefined`,
kept, or have the entire object and the property that holds it deleted. By
default, the data will be kept.

#### `search<T>(storeName: string, searchOptions: RetrieveBySearchOptions, pageOptions?: RetrieveByPageOptions, sortOptions?: RetrieveBySortingOptions): Observable<T[]>`
Search for a value in a specific index using the `RetrieveBySearchOptions`
object. An index is available for each of the (nested) properties that have a
string or number value. Indices are created with dot notation for object keys
(e.g. `main.nested.value`). Boolean and array values are excluded.
Results can be paginated with the `RetrieveByPageOptions` object and/or sorted
with the `RetrieveBySortingOptions` object.

#### `filter<T>(storeName: string, callback: (result: T) => boolean, httpRequest?: HttpRequest<T>, direction?: IDBCursorDirection, pageOptions?: RetrieveByPageOptions, sortOptions?: RetrieveBySortingOptions): Observable<T[]>`
Find one or more specific items in the objectStore with the given callback
function. This allows for more fine-grained searches than the `search` function,
since you have access to the entire object.

#### `find<T>(storeName: string, callback: (result: T) => boolean): Observable<T>`
Similar to `filter`, but for a single item instead of multiple. Returns the
first positive callback match as the desired object.

#### `clear(storeName: string): Observable<boolean>`
Clear out an objectStore completely, removing all data therein.

#### `deleteObjectStore(storeName: string, type: DeleteCascadeOptions): Observable<DeleteResult[]>`
Delete an objectStore completely. Depending on the options given -- replace,
remove or keep the data -- all objectStores that have (deeply nested) links to
the deleted objectStore have their data adjusted. Overwriting the data can be
done with `null` or `undefined`, the entire property with the deleted original
data can be removed, or all data can be kept instead. Returns an array with the
affected storeNames, the amount of rows and the (nested) property where the data
was overwritten or removed.

#### `deleteDatabase(): Observable<void>`
Completely remove the database and its content. This includes all settings and
options previously defined in other persist actions stored in the localStorage,
as well as all in-memory content, links and settings. If this method is chained
in an observable sequence, make sure to have a debounceTime of about 2500ms
after calling this method.

# Persistence
The purpose of the service is to persist data and have it easily accessible via
direct (custom service) or indirect (http interceptor) methods. To make data
persistent, you need to call the `persist` method with one or more objects that
define the shape of the content you want to persist, as well as the required
options for the given data that determine how it will be stored.

## PersistenceOptions
The options are also persistent, but instead of stored in the IndexedDB, the
options are store in the LocalStorage and updated and read each time a `persist`
method call is done, as well as on application start. The definition of the
options is as follows:

```typescript
interface PersistenceOptions {
  // Name for the objectStore. Unique, or will be overwritten.
  storeName: string;
  // Name for the key that includes the UUID or other unique value.
  primaryKey: string;
  // List of keys that can only have unique values.
  uniqueKeys?: string[];
  // Map with object keys that have their own linking options.
  linkedKeys?: Map<string, PersistenceOptions>;
  // Store the content after creating the objectStore. Default true.
  storeContent?: boolean;
  // One or more triggers for certain param/url combinations.
  triggers?: PersistenceIndexTrigger[];
}
```

---
For a successful persistence action, at least the objectStore's name and the key
that determines the primary key for the objectStore need to be set.

```typescript
const options: PersistenceOptions = {
  storeName: 'MyObjectName',
  primaryKey: '@id',
};
```

---
If any of the keys inside the main object need to be unique, you can add an
array with the key names as string to the options, using the `uniqueKeys`
property. **Please keep in mind** to not add keys for non-unique values, like
the UUID of a nested/related object.

```typescript
const options: PersistenceOptions = {
  storeName: 'MyObjectName',
  primaryKey: '@id',
  uniqueKeys: ['email', 'phone'],
};
```

---
If there are relations to other objectStores in the data, you can create the
linkedKeys Map by setting one or more object properties as map keys and creating
new PersistenceOptions for those keys as map values. This also means that nested
related objects can be set in the linkedKeys Map inside the new options for the
current object property, allowing for very complex relations to be extracted
during the persist action. **Keep in mind that the more complex the relations,
the more time it can take to perform data altering for multiple items**. As
such, it is advisable to create a seeder function which creates flattened data
as much as possible and create links that are only nested once. However, to here
is an example of how deep you can create the links:

```typescript
// The base map, with 2 properties that link to another store.
const linkedMap: Map<string, PersistenceOptions> = new Map();
linkedMap.set('person', { storeName: 'Person', primaryKey: '@id', linkedKeys: personLinkMap });
linkedMap.set('location', { storeName: 'Location', primaryKey: '@id' });

// The 'person' map also holds 3 properties that link to another store.
const personLinkMap: Map<string, PersistenceOptions> = new Map();
personLinkMap.set('pupil', { storeName: 'Pupil', primaryKey: '@id', linkedKeys: pupilLinkMap });
personLinkMap.set('primaryEmailAddress', { storeName: 'EmailAddress', primaryKey: '@id' });
personLinkMap.set('primaryPhoneNumber', { storeName: 'PhoneNumber', primaryKey: '@id' });

// The 'pupil' inside 'person' links to 2 other stores.
const pupilLinkMap: Map<string, PersistenceOptions> = new Map();
pupilLinkMap.set(
  'pupilEnrollments',
  { storeName: 'PupilEnrollment', primaryKey: '@id', linkedKeys: enrollmentLinkMap }
);
pupilLinkMap.set(
  'pupilLevelYearStatuses',
  { storeName: 'PupilLevelYearStatus', primaryKey: '@id', linkedKeys: statusesLinkMap }
);

// the 'pupilLevelYearStatuses' holds one more relation.
const statusesLinkMap: Map<string, PersistenceOptions> = new Map();
statusesLinkMap.set('levelYear', { storeName: 'LevelYear', primaryKey: '@id' });

// The 'pupilEnrollments' also has one more relation.
const enrollmentLinkMap: Map<string, PersistenceOptions> = new Map();
enrollmentLinkMap.set('schoolClass', { storeName: 'SchoolClass', primaryKey: '@id', linkedKeys: schoolClassLinkMap });

// The last in the chain of nested relations.
const schoolClassLinkMap: Map<string, PersistenceOptions> = new Map();
schoolClassLinkMap.set('location', { storeName: 'Location', primaryKey: '@id' });

const options: PersistenceOptions = {
  storeName: 'MyObjectName',
  primaryKey: '@id',
  linkedKeys: linkedMap,
};
```

For each of these relations, a new objectStore is created and the link is added
to the parsed object. You will see these properties if you take a look at the
data inside the IndexedDB storage. **Please note: these properties are stripped
when retrieving the data.**

```typescript
const result: object = {
  person: {
    __pkey__: 'extracted UUID or other unique primaryKeyValue here',
    __store__: 'Person',
    pupil: {
      __pkey__: 'some uuid',
      __store__: 'Pupil',
    },
  },
};
```

---
If the data you used to create the database structure should **not** be saved,
make sure to set the `storeContent` boolean toggle to `false`. This will skip
the final step of the `persist` method.

```typescript
const options: PersistenceOptions = {
  storeName: 'MyObjectName',
  primaryKey: 'id',
  uniqueKeys: ['email', 'phone'],
  storeContent: false,
};
```

## `persist`
Combining the PersistenceOptions and the Extractor, here's a **very** extensive
example of how to create persistent storage for a large, complex, layered
dataset:

### The original data

```typescript
export const GET_LOCATION_MEMBER_PUPILS: Collection<GetLocationMember<LocationMemberPupil>> = {
  '@context': '/api/contexts/LocationMember',
  '@id': '/api/locations/7804414e-1cd9-5bc6-820d-4d35af522859/location-members',
  '@type': 'hydra:Collection',
  'hydra:member': [
    {
      '@id': '/api/location-members/006078a8-dc91-4cec-8d50-581b07cf1d3e',
      '@type': 'LocationMember',
      'person': {
        '@id': '/api/people/1854fbbe-01f1-4e06-9f5a-43c553ff83a0',
        '@type': 'Person',
        'fullName': 'Ni no Kuni',
        'pupil': {
          '@id': '/api/pupils/1854fbbe-01f1-4e06-9f5a-43c553ff83a0',
          '@type': 'Pupil',
          'pupilEnrollments': [
            {
              '@id': '/api/pupil-enrollments/e8420b1a-87c2-43b8-8cdd-539d763fee2c',
              '@type': 'PupilEnrollment',
              'schoolClass': {
                '@id': '/api/school-classes/024a965b-9191-454f-8239-3ebb5f33525a',
                '@type': 'SchoolClass',
                'location': {
                  '@id': '/api/locations/7804414e-1cd9-5bc6-820d-4d35af522859',
                  '@type': 'Location',
                  'name': 'Aartsbaan',
                },
                'name': 'ytho',
                'validityRange': {
                  start: '2022-01-14T00:00:00+01:00',
                  end: '2022-08-01T00:00:00+02:00',
                  startInclusive: true,
                  endInclusive: false,
                },
              },
              'validityRange': {
                start: '2022-01-14T00:00:00+01:00',
                end: '2022-08-01T00:00:00+02:00',
                startInclusive: true,
                endInclusive: false,
              },
            }
          ],
          'pupilLevelYearStatuses': [
            {
              '@id': '/api/pupil-level-year-statuses/931c38e7-d3a7-5bc8-985b-66e35acadc86',
              '@type': 'PupilLevelYearStatus',
              'levelYear': {
                '@id': '/api/level-years/d4183e62-593c-462b-abd7-c2a4bac2a133',
                '@type': 'LevelYear',
                'schoolLevel': 'VWO',
                'year': 5,
              },
              'validityRange': {
                start: '2022-01-14T00:00:00+01:00',
                end: '2022-08-01T00:00:00+02:00',
                startInclusive: true,
                endInclusive: false,
              },
            }
          ],
        },
        'firstName': 'Ni',
        'lastNamePrefix': 'no',
        'lastName': 'Kuni',
        'primaryEmailAddress': {
          '@id': '/api/email-address/37a30d02-6db8-519c-9fce-52b1f549fffa',
          '@type': 'EmailAddress',
          'priorityType': 'PRIMARY',
          'value': '957@kuni.jp',
        },
        'primaryPhoneNumber': {
          '@id': '/api/phone-number/37a30d02-6db8-519c-9fce-4d35af522859',
          '@type': 'PhoneNumber',
          'priorityType': 'PRIMARY',
          'value': '957 0987512',
        },
      },
      'location': {
        '@id': '/api/locations/7804414e-1cd9-5bc6-820d-4d35af522859',
        '@type': 'Location',
        'name': 'Aartsbaan',
      },
      'type': PersonType.PUPIL,
      'validityRange': {
        start: '2022-01-14T00:00:00+01:00',
        end: '2022-08-01T00:00:00+02:00',
        startInclusive: true,
        endInclusive: false,
      },
    }, {
      '@id': '/api/location-members/109172f8-ab64-48ad-be2b-5a00f8058a87',
      '@type': 'LocationMember',
      'person': {
        '@id': '/api/people/8eab3f47-cbcd-3e70-9186-b0d5302cd915',
        '@type': 'Person',
        'fullName': 'Loes El Idrissi',
        'pupil': {
          '@id': '/api/pupils/8eab3f47-cbcd-3e70-9186-b0d5302cd915',
          '@type': 'Pupil',
          'pupilEnrollments': [
            {
              '@id': '/api/pupil-enrollments/aaa51399-9bea-4e1f-8c20-80bfaaab4e04',
              '@type': 'PupilEnrollment',
              'schoolClass': {
                '@id': '/api/school-classes/f7944b57-cd82-490c-a806-b9ba0ca57ddf',
                '@type': 'SchoolClass',
                'location': {
                  '@id': '/api/locations/58bc6cfa-e64f-5561-814f-cba46ec6cc51',
                  '@type': 'Location',
                  'name': 'Alpaidislaan',
                },
                'name': '55l35',
                'validityRange': {
                  start: '2018-10-30T00:00:00+01:00',
                  end: '2022-05-07T00:00:00+02:00',
                  startInclusive: true,
                  endInclusive: false,
                },
              },
              'validityRange': {
                start: '2020-03-29T00:00:00+01:00',
                end: '2020-04-07T00:00:00+02:00',
                startInclusive: true,
                endInclusive: false,
              },
            }, {
              '@id': '/api/pupil-enrollments/7555d791-245b-4f72-93ed-aad7827dda7a',
              '@type': 'PupilEnrollment',
              'schoolClass': {
                '@id': '/api/school-classes/ecc978e9-1bc4-4ce8-bccd-c55ce93e8235',
                '@type': 'SchoolClass',
                'location': {
                  '@id': '/api/locations/a26e4057-c307-5bc5-903f-5c85f33382c7',
                  '@type': 'Location',
                  'name': 'De Heemgaard Apeldoorn',
                },
                'name': '8x62',
                'validityRange': {
                  start: '2021-09-01T00:00:00+02:00',
                  end: '2022-08-31T00:00:00+02:00',
                  startInclusive: true,
                  endInclusive: false,
                },
              },
              'validityRange': {
                start: '2022-07-18T00:00:00+02:00',
                end: '2022-08-10T00:00:00+02:00',
                startInclusive: true,
                endInclusive: false,
              },
            }
          ],
          'pupilLevelYearStatuses': [
            {
              '@id': '/api/pupil-level-year-statuses/895956ca-2a2e-5301-9584-84bbf1a020ff',
              '@type': 'PupilLevelYearStatus',
              'levelYear': {
                '@id': '/api/level-years/8ed62fda-0054-40b8-8f71-d8ef6ec5bb6c',
                '@type': 'LevelYear',
                'schoolLevel': 'VWO',
                'year': 6,
              },
              'validityRange': {
                start: '2019-11-19T00:00:00+01:00',
                end: '2022-05-12T00:00:00+02:00',
                startInclusive: true,
                endInclusive: false,
              },
            }
          ],
        },
        'firstName': 'Loes',
        'lastNamePrefix': '',
        'lastName': 'El Idrissi',
        'primaryEmailAddress': {
          '@id': '/api/email-address/3dff67f5-ad43-5521-bcf4-64dc0db2a337',
          '@type': 'EmailAddress',
          'priorityType': 'PRIMARY',
          'value': 'robin.hendriks@sahin.nl',
        },
        'primaryPhoneNumber': {
          '@id': '/api/phone-number/37a30d02-6db8-519c-9fce-64dc0db2a337',
          '@type': 'PhoneNumber',
          'priorityType': 'PRIMARY',
          'value': '957 0987512',
        },
      },
      'location': {
        '@id': '/api/locations/58bc6cfa-e64f-5561-814f-cba46ec6cc51',
        '@type': 'Location',
        'name': 'Alpaidislaan',
      },
      'type': PersonType.PUPIL,
      'validityRange': {
        start: '2018-10-30T00:00:00+01:00',
        end: '2022-05-07T00:00:00+02:00',
        startInclusive: true,
        endInclusive: false,
      },
    }
  ],
  'hydra:totalItems': 2,
};
```

### The basic Extractor setup

```typescript
// The global key map.
const globalMap: Map<string, Generatable> = new Map();
// The Hydra content. Generate between 30 and 50 items.
const hydraMember: GenerateArray = new GenerateArray({
  key: 'hydra:member',
  content: null,
  minItems: 30,
  maxItems: 50,
});
// ValidityRange object, with proper ranges for the start/end dates.
const validityRange: GenerateObject = new GenerateObject({
  key: 'validityRange',
  content: [
    new GenerateDate({
      key: 'start',
      format: 'yyyy-MM-dd\'T\'HH:mm:ss+01:00',
      dateRangeStart: subDays(new Date(), 100),
      dateRangeEnd: subDays(new Date(), 10),
    }),
    new GenerateDate({
      key: 'end',
      format: 'yyyy-MM-dd\'T\'HH:mm:ss+01:00',
      dateRangeStart: addDays(new Date(), 30),
      dateRangeEnd: addDays(new Date(), 300),
    }),
    new GenerateCustom({ key: 'startInclusive', value: startInclusive }),
    new GenerateCustom({ key: 'endInclusive', value: endInclusive }),
  ],
});

globalMap.set(hydraMember.key, hydraMember);
globalMap.set(validityRange.key, validityRange);
```

```typescript
// Settings for the `@type` value inside the JsonLd objects.
const typeMap: Map<string, GenerateObject> = new Map();
// Type is 'EmailAddress', add a default custom value 'PRIMARY' to priorityType.
const primaryEmailAddress: GenerateObject = new GenerateObject({
  key: 'EmailAddress',
  content: [new GenerateCustom({ key: 'priorityType', value: PriorityType.PRIMARY })],
});
// Type is 'PhoneNumber', add a default custom value 'PRIMARY' to priorityType.
const primaryPhoneNumber: GenerateObject = new GenerateObject({
  key: 'PhoneNumber',
  content: [new GenerateCustom({ key: 'priorityType', value: PriorityType.PRIMARY })],
});
// Type is 'LocationMember'. Add a default value 'PUPIL' to type.
const locationMember: GenerateObject = new GenerateObject({
  key: 'LocationMember',
  content: [new GenerateCustom({ key: 'type', value: PersonType.PUPIL })],
});

typeMap.set(primaryEmailAddress.key, primaryEmailAddress);
typeMap.set(primaryPhoneNumber.key, primaryPhoneNumber);
typeMap.set(locationMember.key, locationMember);
```
```typescript
// Create a custom, constistent location for all LocationMembers.
// First define the Location.
const generate: Generatable = new GenerateObject({
  key: '',
  resource: {
    prefix: '/api/locations/',
    type: 'Location',
  },
  content: [
    new GenerateWord({
      key: 'name',
      minLength: 5,
      maxLength: 15,
      capitalize: true,
    }),
  ],
});
// Generate the definition for the location.
const generated: Resource<GetLocationsResponse> = this.persistence.generator.generate(
  generate,
  true,
) as Record<string, unknown>;
// Define the settings for the static location data.
const location: GenerateObject = new GenerateObject({
  key: 'Location',
  content: [
    new GenerateCustom({ key: '@id', value: generated['@id'] }),
    new GenerateCustom({ key: '@type', value: generated['@type'] }),
    new GenerateCustom({ key: 'name', value: generated['name'] }),
  ],
});
// Set it in the typeMap. Each 'Location' type will now have the same data.
typeMap.set('Location', location);
```

```typescript
// Extract the data via the extractor in the PersistenceService, using the
// defined globalMap and typeMap.
const extracted: Record<string, unknown> = this.persistence.extractor.extract(
  GET_LOCATION_MEMBER_PUPILS as never as Record<string, unknown>,
  {
    globalKeyMap: globalMap,
    typeMap: typeMap,
  },
) as Record<string, unknown>;
// Persist the data with the options defined in the example.
this.persistence.persist(extracted, options).subscribe((results) => console.log(results));
```
The result log:
```json
[
  {
    "storeName": "Location",
    "rows": 1,
    "indices": [
      "name",
      "__pkey__"
    ]
  },
  {
    "storeName": "SchoolClass",
    "rows": 62,
    "indices": [
      "location.name",
      "location.__pkey__",
      "location",
      "name",
      "validityRange.start",
      "validityRange.end",
      "validityRange",
      "__pkey__"
    ]
  },
  {
    "storeName": "PupilEnrollment",
    "rows": 62,
    "indices": [
      "schoolClass.location.name",
      "schoolClass.location.__pkey__",
      "schoolClass.location",
      "schoolClass.name",
      "schoolClass.validityRange.start",
      "schoolClass.validityRange.end",
      "schoolClass.validityRange",
      "schoolClass.__pkey__",
      "schoolClass",
      "validityRange.start",
      "validityRange.end",
      "validityRange",
      "__pkey__"
    ]
  },
  {
    "storeName": "LevelYear",
    "rows": 65,
    "indices": [
      "schoolLevel",
      "year",
      "__pkey__"
    ]
  },
  {
    "storeName": "PupilLevelYearStatus",
    "rows": 65,
    "indices": [
      "levelYear.schoolLevel",
      "levelYear.year",
      "levelYear.__pkey__",
      "levelYear",
      "validityRange.start",
      "validityRange.end",
      "validityRange",
      "__pkey__"
    ]
  },
  {
    "storeName": "Pupil",
    "rows": 10,
    "indices": [
      "__pkey__"
    ]
  },
  {
    "storeName": "EmailAddress",
    "rows": 10,
    "indices": [
      "priorityType",
      "value",
      "__pkey__"
    ]
  },
  {
    "storeName": "PhoneNumber",
    "rows": 10,
    "indices": [
      "priorityType",
      "value",
      "__pkey__"
    ]
  },
  {
    "storeName": "Person",
    "rows": 10,
    "indices": [
      "fullName",
      "pupil.__pkey__",
      "pupil",
      "firstName",
      "lastNamePrefix",
      "lastName",
      "primaryEmailAddress.priorityType",
      "primaryEmailAddress.value",
      "primaryEmailAddress.__pkey__",
      "primaryEmailAddress",
      "primaryPhoneNumber.priorityType",
      "primaryPhoneNumber.value",
      "primaryPhoneNumber.__pkey__",
      "primaryPhoneNumber",
      "__pkey__"
    ]
  },
  {
    "storeName": "LocationMember",
    "rows": 10,
    "indices": [
      "person.fullName",
      "person.pupil.__pkey__",
      "person.pupil",
      "person.firstName",
      "person.lastNamePrefix",
      "person.lastName",
      "person.primaryEmailAddress.priorityType",
      "person.primaryEmailAddress.value",
      "person.primaryEmailAddress.__pkey__",
      "person.primaryEmailAddress",
      "person.primaryPhoneNumber.priorityType",
      "person.primaryPhoneNumber.value",
      "person.primaryPhoneNumber.__pkey__",
      "person.primaryPhoneNumber",
      "person.__pkey__",
      "person",
      "location.name",
      "location.__pkey__",
      "location",
      "type",
      "validityRange.start",
      "validityRange.end",
      "validityRange",
      "__pkey__"
    ]
  }
]
```

# Known issues
- Speed on very large datasets is impacted.
- Updating many (deeply) linked items will throw a `mergeMap` overflow error,
  due to the nature of recursive updating. It is recommended to have fewer links
  when creating the dataset, by splitting the dataset into more layers.
