# Generator Class
To facilitate the option to generate a lot of randomly generated data, the
Generator class has been created for your convenience. This class uses a
combination of the various GenerateX models to create randomly generated data
according to the given specifications. This can be tuned to a good degree,
within reasonable assumptions, of course.

### Properties and functions
The Generator has several publicly accessible properties and functions you can
change or use:

#### `locale: string`
Supports Dutch, `'nl'`, or English, `'en'`, locales at the moment. These are
used to determine the locale for Faker and Date-fns.

#### `faker: Faker`
Gives access to the active Faker instance. Used in custom generation functions
or when changing the locale to non-default values. Call the `faker.setLocale`
method in order to update the locale to a custom value before generating data.

#### `dateFns: object`
Get/set the object imported from `date-fns/locale`. Default is the Dutch locale,
but for custom locale settings import and set the locale you want.

#### `generated: Record<string, unknown>`
Returns the currently generated values. This is a snapshot, so when accessed in
a custom function, only the data generated at that point is accessible.

#### `rng(min?: number, max?: number): number`
Simple Random Number Generation between an optional minimum and maximum value.
Default values are between 1 and the minimum value (or 0) + 10.

#### `yes()`
Shorthand for Faker's boolean datatype. Returns true or false randomly.

#### `generate<T>(content: Generatable, noCache?: boolean): ...`
The main generation function. See `Generation` for more details.

#### `generateCollection<T>(item: GenerateArray, members: unknown[]): ...`
Generate an array specifically within the parameters of the Hydra+JsonLd setup.
This will add the JsonLd `@type`, `@id` and `@context`, puts the generated array
items in `hydra:member` and adds the length of the items to `hydra:totalItems`.

#### `generateResource(item: GenerateObject, generated: Record<string, unknown>): ...`
Generate an object specifically within the parameters of the JsonLd setup. This
will add the `@type`, `@id` and `@context` properties. If the GenerateObject
contains Generate types for those properties, the newly generated values will
overwrite the standard values.

# Generation
Supply the `generate` function with one of the GenerateX object models. Typing
is optional, but has to be re-cast, so it's mostly aesthetics. For custom
generation functions, the `noCache` option is added, which will stop the methods
that utilize the `Generator.generated` cache from adding the generated content
to it.

## Example
```typescript
const generated: Generatable = new GenerateObject({
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
        new GenerateCustom({ key: 'startInclusive', value: true }),
        new GenerateCustom({ key: 'endInclusive', value: true }),
    ],
});
```
This example shows the basic setup of creating a whole range of different
generation objects. In this case, the standard `validityRange` object is made.
The date ranges are set using `date-fns` functions, so a somewhat sensible start
and end range is set to generate *between*. Custom values are used for the
inclusive start and end, since no random `true` or `false` is desired. The end
result will be a `validityRange` object looking like:

```javascript
validityRange: {
    start: "2022-03-28T22:22:15+01:00",
    end: "2023-04-01T17:49:37+01:00",
    startInclusive: true,
    endInclusive: true,
}
```
Similarly, any type of standard content can be generated using the various class
objects. Since all have some base properties to take into account:

## GenerateBase
```typescript
interface GeneratingBase {
    // What the object's property name will be once generated.
    key: string;

    // Can null values be generated?
    allowNull?: boolean;
    // On a scale of 0-100, what are the odds of nulls generating?
    percentageNull?: number;

    // Can values be undefined?
    allowOptions?: boolean;
    // On a scale of 0-100, what are the odds of the value being undefined?
    percentageOptional?: number;
}
```
Except for one, all GenerateX models extend the base class for some basic
functionality. These basic options define the key/value for the content to be
generated and whether they can be null or undefined values and how often that
occurs.

## GenerateNumber
```typescript
interface GeneratingNumber extends GeneratingBase {
  // Lowest number to generate between.
  min?: number;
  // Highest number to generate between.
  max?: number;
  // Faker precision, the length of the floating point number.
  precision?: number;
}
```
Random number generation, between the given `min` value (or 0) and the `max`
value (or 10). The floating point precision can be set using the `precision`
property and will determine how many digits are generated. A value of `0.001`
will generate 3 digits for the fractional values.

## GenerateWord
```typescript
interface GeneratingWord extends GeneratingBase {
    // Minimum length of the word.
    minLength?: number;
    // Maximum length of the word.
    maxLength?: number;
    // Capitalize the first letter.
    capitalize?: boolean;
    // List of words to exclude when generating.
    exclude?: string[];
}
```
String generation, part one: The word. The minimum and maximum string length of
the word can be set with `minLength` and `maxLength`. If you want the first
letter of the word to be uppercase, set the `capitalize` flag to true. If you're
generating something that requires unique values, add all already generated word
values in the `exclude` array and pass them on. If the `exclude` array is not
set, generation will be done without checking for unique values.

## GenerateText
```typescript
interface GeneratingText extends GeneratingBase {
    // Least amount of words in the sentence.
    minWords?: number;
    // Maximum amount of words in the sentence.
    maxWords?: number;

    // Minimum amount of sentences in the paragraph.
    minSentences?: number;
    // Maximum amount of sentences in the paragraph.
    maxSentences?: number;

    // Minimum amount of blocks of text.
    minBlocks?: number;
    // Maximum amount of blocks of text.
    maxBlocks?: number;
}
```
String generation, part two: More than one word. Generate a sentence, paragraph,
or several blocks of text with wonderful Lorem Ipsum. Choose one of the three
types of generation -- words, sentences or blocks.

## GenerateUuid
```typescript
interface GeneratingUuid extends GeneratingBase {
    // Place this before the UUID.
    prefix?: string;
    // Place this after the UUID.
    suffix?: string;
}
```
String generation, part three: UUID. Generate a simple, single UUID or, for when
the need arises, an IRI can be 'generated' by adding a prefix and/or a suffix.

## GenerateDate
```typescript
interface GeneratingDate extends GeneratingBase {
    // Date-fns formatting for the generation.
    format: string;
    // Earliest date to generate from, ISO string, epoch or Date object.
    dateRangeStart?: string | number | Date;
    // Latest date to generate to, ISO string, epoch or Date object.
    dateRangeEnd?: string | number | Date;
}
```
String generation, part four: Dates, using `date-fns` formatting and locale. To
set the range from, to or between a date can be generated, supply either or both
of the `dateRangeStart` and `dateRangeEnd` values. These can be a date as **ISO
string**, a **Unix epoch** value or a javascript **Date object**.

## GenerateEmail
```typescript
interface GeneratingEmail extends GeneratingBase {
  // First name to include in the generation.
  firstName?: string;
  // Lastname to include in the generation.
  lastName?: string;
  // Domain to use as default namespace in the generation.
  domain?: string;
}
```
String generation, part five: Email addresses, optionally supplied with first
name, last name and/or domain. If given those values, a randomized email address
will be generated with the given parameters. Otherwise, Faker will just create a
random email address.

## GeneratePhoneNumber
```typescript
interface GeneratingPhoneNumber extends GeneratingBase {
    // Faker formatting for phone number generation.
    format?: string;
}
```
String generation, part six: Phone numbers. Generate a randomized phone number.
If no format is supplied, the default `+31 6## ######` is used. All pound signs
are replaced with digits, anything else is returned as-is, so the default will
return a phone number that will **always** start with `+31 6`, followed by 2
random digits, a space and 6 more random digits.

## GenerateBoolean
```typescript
interface GeneratingBoolean extends GeneratingBase {
    // On a scale of 0-100, what are the odds of it being true?
    percentageTrue?: number;
}
```
Generate a boolean value with a percentage chance (default 50). A number is
generated between and 100 and if its at or below the percentage value, `true`
is returned.

## GenerateObject
```typescript
interface GeneratingObject extends GeneratingBase {
    // Make this a JsonLd resource object.
    resource?: GenerateResource;
    // An array of various Generatable items that form this object.
    content: Generatable[];
}

export interface GenerateResource {
    // First part of the path for the `@id` tag.
    prefix?: string;
    // Second part of the path for the `@id` tag.
    suffix?: string;
    // The `@type` value. Defaults to `hydra:Collection`.
    type?: string;
}
```
Generate an object with key/value pairs based on the `content` array of
Generatable class objects. If the `resource` property is set, the object will
have missing `@type`, `@context` and `@id` values generated.

## GenerateArray
```typescript
interface GeneratingArray extends GeneratingBase {
    // Type of content that will be generated. Null returns an empty array.
    content: Generatable | GeneratePrimitive | null;
    // Make this a Hydra collection object instead.
    collection?: GenerateCollection;
    // Generate at least this amount of items.
    minItems?: number;
    // Generate at most this amount of items.
    maxItems?: number;
    // Toggle the sorting of array values.
    sort?: boolean;
    // If the content is any type of object, set the key to sort on.
    sortKey?: string;
    // Sorting direction.
    sortDirection?: 'asc' | 'desc';
}

export interface GenerateCollection extends GenerateResource {
    // Generate a UUID between the prefix and suffix in the `@id` field.
    uuid?: boolean;
}
```
Used to generate an array of a certain type of value. This can be a primitive or
object value. The class can be used to generate a Hydra collection as well,
using the `collection` property object. This will automatically assign the
Hydra+JsonLd values and insert the generated content in the `hydra:member`
field.

### Note
If the `content` value is a `GenerateObject`, the `key` value will be ignored.

## GenerateCustom
```typescript
interface GeneratingCustom extends GeneratingBase {
    // Any value can be set here.
    value: unknown;
    // Use a function to access the Generator and generate your own content.
    custom?: (generator: Generator) => unknown;
}
```
Generate a custom value, or use a completely custom function for generating any
type of value. Since the Generator instance currently in use is supplied in the
function, Faker can be accessed and the localisation can be changed each time
you generate anything. The returned value from `custom` must be a generated
value, so remember to access the `generator.generate(myStuff, true)` to generate
your template **without** caching.

## GeneratePrimitive
```typescript
interface GeneratingPrimitive {
    // Type of primitive to generate, or a custom function.
    content: GenerateNumber | GeneratableString | GenerateBoolean;
    // Custom function that returns a primtive value.
    custom?: (current: Generator) => string | boolean | number;
}
```
Since arrays can contain a list of primitives instead of a list of objects, the
GeneratePrimitive is here to help out. The `content` value can be one of the
three primitives that make sense: `number`, `string` or `boolean` and can be any
of the generation class objects associated with those. The `key` property in
these class objects will be ignored and can be set to any string value.
Similarly to the GenerateCustom class, the `custom` function can be used to call
a function that returns a custom generated primitive value.
