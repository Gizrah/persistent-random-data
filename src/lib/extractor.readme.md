# Extractor Class
Convert any ol' javascript object or array first to a tree of Generatable class
objects and use the `Generator` class to create randomized data with the default
randomization parameters applied. In essence, you can create the results of a
backend call and change the amount of items you want to create different, more,
less or full-on garbage results.

### Properties and functions
The Extractor has two publicly accessible members, the Generator class and the
extracting function:

#### `generator: Generator`
The Generator class instance. You can change this to an instance of your own, or
use the already available generator instance instead to access Faker or generate
what you want.

#### `extract(data: Record<string, unknown> | Record<string, unknown>[], options?: ExtractorOptions): unknown`
This function extracts the 'what' and 'how' in the given data. With the options
object, you can set different Generatable options similarly to how the Generator
works.

## Options: keyMap
If any of the (nested) keys require a specific Generatable definition or custom
function, you can set a Map with the path to the key as Generatable or another
Map instance.

#### Example
```typescript
// { nestedA: { nestedB: { test: {} } } }
const keyMap: Map<string, KeyMapType> = new Map();
const nestedA: Map<string, KeyMapType> = new Map();
const nestedB: Map<string, KeyMapType> = new Map();
const example: Generatable = new GenerateObject({ key: 'test', content: [] });
keyMap.set('nestedA', nestedA);
nestedA.set('nestedB', nestedB);
nestedB.set(example.key, example);
```

## Options: typeMap
For objects that have JsonLd values and, at least, the `@type` property, the
value for this property will be checked in the `typeMap`. You can set (some of)
the content for this `GenerateObject`. This can also be used to generate custom
values for deeply nested key/value pairs that are simply part of the type.

#### Example
```typescript
const typeMap: Map<string, GenerateObject> = new Map();
const myType: GenerateObject = new GenerateObject({
   key: 'MyType',
   content: [
     new GenerateCustom({
         key: 'type',
         value: PriorityType.PRIMARY,
     }),
   ],
});
typeMap.set(myType.key, myType);
```

## Options: globalKeyMap
A combination of the `keyMap` and `typeMap`, certain repeating key/value pairs
can be set as a default value in the `globalKeyMap`, instead of nesting the ever
loving excrement for each recurrence of the same non-type result, or repeating
the same Generatable in each type that holds it (e.g. `validityRange`).

#### Example
```typescript
const globalMap: Map<string, Generatable> = new Map();
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
globalMap.set(validityRange.key, validityRange);
```

## Extraction and generation of null or undefined values
If an array holds objects with optional keys, the generation for this key/value
pair will have the `allowOptions` flag set to true. The chance will be defined
by the simple calculation `(amount of undefineds / total amount) * 100`. The
same is done for `null` values.
