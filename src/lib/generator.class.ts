import { Faker, faker } from '@faker-js/faker';
import { format } from 'date-fns';
import { enUS as dateEN, nl as dateNL } from 'date-fns/locale';
import { GeneratableKeyNotFoundError } from './errors/generatable-key-not-found.error';
import { WordRetryOverflowError } from './errors/word-retry-overflow.error';
import { Generatable, Unknown } from './interfaces/shared.type';
import { GenerateArray } from './models/generate-array.model';
import { GenerateBoolean } from './models/generate-boolean.model';
import { GenerateCustom } from './models/generate-custom.model';
import { GenerateDate } from './models/generate-date.model';
import { GenerateEmail } from './models/generate-email.model';
import { GenerateNumber } from './models/generate-number.model';
import { GenerateObject } from './models/generate-object.model';
import { GeneratePhoneNumber } from './models/generate-phone.model';
import { GeneratePrimitive } from './models/generate-primitive.model';
import { GenerateText } from './models/generate-text.model';
import { GenerateUuid } from './models/generate-uuid.model';
import { GenerateWord } from './models/generate-word.model';

type ArrayType = Unknown | Primitive;
type Primitive = StringInt | bigint | boolean | symbol | undefined;
type StringInt = string | number;

/**
 * Generate randomized content using a relatively simple constructor-name-based
 * creation of data.
 *
 * @example ```
 * ```
 */
export class Generator {

  /**
   * Cached content.
   */
  private cache: Unknown;

  /**
   * Locale name. Used for dates as well. Default 'nl'.
   */
  private localeString: string;

  /**
   * Localized Faker instance.
   */
  private fakerInstance: Faker = faker;

  /**
   * Date-fns locale.
   */
  private dateFnsLocale: object = { locale: dateNL };

  constructor() {
    this.locale = 'nl';
  }

  /**
   * Return the current locale.
   */
  public get locale(): string {
    return this.localeString;
  }

  /**
   * Set the current locale string. Changes the Date-fns locale as well as the
   * current Faker locale to the given string, or if not in the switch-case,
   * defaults to 'nl'.
   */
  public set locale(locale: string) {
    switch (locale) {
      case 'nl':
        this.dateFns = { locale: dateNL };
        this.faker.setLocale(locale);
        break;
      case 'en':
        this.dateFns = { locale: dateEN };
        this.faker.setLocale(locale);
        break;
      default:
        this.dateFns = { locale: dateNL };
        this.faker.setLocale('nl');
        break;
    }
    this.localeString = locale;
  }

  /**
   * Return the current Faker instance.
   */
  public get faker(): Faker {
    return this.fakerInstance;
  }

  /**
   * Return the current Date-fns locale object.
   */
  public get dateFns(): object {
    return this.dateFnsLocale;
  }

  /**
   * Set the current Date-fns locale object.
   */
  public set dateFns(locale: object) {
    this.dateFnsLocale = locale;
  }

  /**
   * Retrieve the generated value.
   */
  public get generated(): Unknown {
    return this.cache;
  }

  /**
   * Return a random number between the min and max values. If partial params
   * are given, the range will be between 1 and something higher than 1 or the
   * minimum value + 10.
   */
  public rng(min?: number, max?: number): number {
    if (typeof min === 'number' && min === max) {
      return min;
    }

    const [baseMin, baseMax] = this.minMax(min, max);
    return this.faker.datatype.number({ min: baseMin, max: baseMax });
  }

  /**
   * Get a tuple with the minimum and maximum values between the given min and
   * max parameters, where either or both can be your preferred minimum or
   * maximum value. Returned minimum is always below the maximum value, returned
   * maximum is always below the minimum value.
   */
  public minMax(min?: number, max?: number): [number, number] {
    let baseMin: number = min ?? (max ?? 11) - 10;
    let baseMax: number = max ?? (min ?? 0) + 10;

    if (baseMin < 0) {
      baseMin = 0;
    }

    if (baseMin > baseMax) {
      baseMax = baseMin + 10;
    }

    return [baseMin, baseMax];
  }

  /**
   * Yes or no?
   */
  public yes(): boolean {
    return this.faker.datatype.boolean();
  }

  /**
   * Generate content based on the Generatable setup. To change the locale for
   * each generating cycle, set the locale and/or dateFns to the desired content
   * before calling this method.
   * If used inside a custom function, the cache may not be desirable to be
   * overwritten, so set noCache to true.
   */
  public generate<T>(content: Generatable, noCache?: boolean): Unknown | T {
    // Define and switch the type of Generatable content.
    let generated: unknown = this.generateItem(content as Generatable, {});

    // Add Hydra Collection flavor if set.
    if (content instanceof GenerateArray && !!content.collection) {
      generated = this.generateCollection(content, generated as unknown[]);
    }

    // Add JsonLd Resource flavor if set.
    if (content instanceof GenerateObject && !!content.resource) {
      generated = this.generateResource(content, generated as Unknown);
    }

    // If called with noCache, return only the generated value.
    if (noCache) {
      return generated as Unknown | T;
    }

    this.cache = generated as Unknown;
    return this.cache as Unknown | T;
  }

  /**
   * Creates a Hydra object from the generated content.
   */
  public generateCollection<T>(item: GenerateArray, members: unknown[]): Unknown | T {
    const id: string = item.collection?.uuid
      ? (item.collection?.prefix ?? '') + this.faker.datatype.uuid() + (item.collection?.suffix ?? '')
      : (item.collection?.prefix ?? '' + item.collection?.suffix ?? '');
    return {
      '@context': 'api/contexts/generateHydra',
      '@type': item.collection?.type ?? 'hydra:Collection',
      '@id': id,
      'hydra:member': members,
      'hydra:totalItems': members.length,
    };
  }

  /**
   * Creates a resource object from the generated content.
   */
  public generateResource(item: GenerateObject, generated: Unknown): Unknown {
    return {
      '@context': 'api/contexts/' + item.className,
      '@type': item.resource?.type ?? item.className,
      '@id': (item.resource?.prefix ?? '')
        + (item.resource?.uuid ?? this.faker.datatype.uuid())
        + (item.resource?.suffix ?? ''),
      ...generated,
    };
  }

  /**
   * Generate the value for the Generatable item. If the item can be undefined,
   * a check is performed before any generation is done. If false, the null
   * check is done next, so if the item can be null, the percentage chance will
   * be applied and if not null, the value will be returned either as addition
   * to the cache, or as raw value if no key is found.
   */
  private generateItem(item: Generatable, cache: Unknown): Unknown | unknown {
    if (item.allowOptional) {
      const percentageOptional: number = item.percentageOptional ?? 10;
      const optional: boolean = this.rng(0, 100) <= percentageOptional;
      if (optional) {
        return (item.key && item.key !== '') ? cache : undefined;
      }
    }

    const min: number = item.allowNull ? item.percentageNull ?? 10 : -1;
    const value: unknown = this.rng(1, 100) <= min ? null : this.generatorSwitch(item, cache);

    if (!item.key || item.key === '') {
      return value;
    }

    cache[item.key] = value;
    return cache;
  }

  /**
   * Using the constructor name of the Generatable item, returns the generator
   * function value for that item.
   */
  //eslint-disable-next-line complexity
  private generatorSwitch(item: Generatable, cache: Unknown): unknown {
    switch (item.className) {
      case 'GenerateNumber':
        return this.generateNumber(item);
      case 'GenerateWord':
        return this.generateWord(item as GenerateWord);
      case 'GenerateText':
        return this.generateText(item);
      case 'GenerateUuid':
        return this.generateUuid(item);
      case 'GenerateDate':
        return this.generateDate(item as GenerateDate);
      case 'GenerateEmail':
        return this.generateEmail(item);
      case 'GenerateBoolean':
        return this.generateBoolean(item);
      case 'GeneratePhoneNumber':
        return this.generatePhoneNumber(item);
      case 'GenerateCustom':
        const custom: GenerateCustom = item as GenerateCustom;
        return custom.custom ?? custom.value;
      case 'GenerateObject':
        return this.generateObject(item as GenerateObject, cache);
      case 'GenerateArray':
        return this.generateArray(item as GenerateArray, cache);
      default:
        return undefined;
    }
  }

  /**
   * Generate a number between the given parameters, or defaults to a number
   * between 0 and 10. Add a precision value to generate fractional values.
   */
  private generateNumber(item: GenerateNumber): number {
    const [min, max] = this.minMax(item.min, item.max);
    const asFloat: number = parseFloat(String(item.precision));
    const asInt: number = parseInt(String(item.precision), 10);
    const options: Record<string, number> = {
      min: min,
      max: max,
    };
    // Checking to make sure the precision number is a floating point number.
    if (!isNaN(item.precision as number) && asFloat !== asInt && asFloat === item.precision) {
      options['precision'] = item.precision;
    }
    return this.faker.datatype.number(options);
  }

  /**
   * Generate a word. Uses RNG to determine the length of the word based on the
   * min/max length values or the defaults for either. Uses randomized boolean
   * checks to determine the type of word, or falls back to a noun.
   */
  // eslint-disable-next-line complexity,max-lines-per-function
  private generateWord(item: GenerateWord): string {
    if (item.retries > 3) {
      throw new WordRetryOverflowError(item);
    }
    const length: number = this.rng(item.minLength ?? 3, item.maxLength ?? 10);
    let selected: Function | undefined;
    if (this.yes()) {
      selected = this.faker.word.verb;
    }
    if (this.yes() && !selected) {
      selected = this.faker.word.adverb;
    }
    if (this.yes() && !selected) {
      selected = this.faker.word.adjective;
    }
    let value: string;
    selected = selected ?? this.faker.word.noun;
    if (item.exclude?.length) {
      try {
        value = this.faker.helpers.unique(
          selected as never,
          [length] as never,
          { exclude: item.exclude ?? [], maxRetries: 3 },
        );
      } catch (error) {
        value = this.generateWord(item);
      }
    } else {
      value = selected.apply(selected,[length]);
      if (!value) {
        value = this.generateWord(item);
      }
    }
    value = item.capitalize ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    return item.prefix ? item.prefix + value : value;
  }

  /**
   * Generate one or more words, sentences or paragraphs of Lorem Ipsum. Uses
   * RNG to determine the amount of words, length of the sentence or amount of
   * blocks of text. Though all values have a default, if none of the options
   * are set, a random Lorem Ipsum sentence is returned.
   */
  //eslint-disable-next-line complexity
  private generateText(item: GenerateText): string {
    if (item.minWords || item.maxWords) {
      const length: number = this.rng(item.minWords ?? 3, item.maxWords ?? 10);
      return this.faker.lorem.words(length);
    }

    if (item.minSentences || item.maxSentences) {
      const length: number = this.rng(item.minSentences ?? 2, item.maxSentences ?? 10);
      return this.faker.lorem.sentences(length);
    }

    if (item.minBlocks || item.maxBlocks) {
      const length: number = this.rng(item.minBlocks ?? 2, item.maxBlocks ?? 5);
      return this.faker.lorem.paragraphs(length, '\r\n\r\n');
    }

    return this.faker.lorem.sentence();
  }

  /**
   * Generate a UUID with or without prefix and/or suffix.
   */
  private generateUuid(item: GenerateUuid): string {
    return (item.prefix ?? '') + this.faker.datatype.uuid() + (item.suffix ?? '');
  }

  /**
   * Generate a date in a (specific) range. If no range is present, uses a
   * random boolean check to create a date between 'soon' and 'recent'.
   */
  private generateDate(item: GenerateDate): string {
    let date: Date = new Date();

    if (item.dateRangeStart && item.dateRangeEnd) {
      date = this.faker.date.between(item.dateRangeStart, item.dateRangeEnd);
    }

    if (item.dateRangeStart && !item.dateRangeEnd) {
      date = this.faker.date.future(30, item.dateRangeStart);
    }

    if (!item.dateRangeStart && item.dateRangeEnd) {
      date = this.faker.date.past(30, item.dateRangeEnd);
    }

    if (!item.dateRangeStart && !item.dateRangeEnd) {
      date = this.yes() ? this.faker.date.soon() : this.faker.date.recent();
    }

    return format(date, item.format, this.dateFns);
  }

  /**
   * Generate an email address. Supply a first and/or last name to create a
   * personalized email address. Add a domain to have a consistent organization
   * like structure.
   */
  private generateEmail(item: GenerateEmail): string {
    return this.faker.internet.email(item.firstName, item.lastName, item.domain);
  }

  /**
   * Generate a phone number with the given format or the default formatting
   * string.
   */
  private generatePhoneNumber(item: GeneratePhoneNumber): string {
    const phoneFormat: string = item.format ?? '+31 6## ######';

    return this.faker.phone.number(phoneFormat);
  }

  /**
   * Generate a boolean, optionally using a percentage chance of true value.
   */
  private generateBoolean(item: GenerateBoolean): boolean {
    const min: number = item.percentageTrue ?? 50;
    return this.rng(1, 100) <= min;
  }

  /**
   * Generate an object template using Generatable content.
   */
  private generateObject(item: GenerateObject, cache: Unknown): Unknown {
    let record: Unknown = cache ?? {};
    if (item.key) {
      cache[item.key] = cache[item.key] ?? {};
      record = cache[item.key] as Unknown;
    }

    for (const generate of item.content) {
      if (!generate.key || generate.key === '') {
        // Just in case someone forgot a key name.
        throw new GeneratableKeyNotFoundError(generate, item);
      }
      const generated: Unknown = this.generateItem(generate, record) as Unknown;
      if (generated) {
        record = generated;
      }
    }

    if (item.resource) {
      record = this.generateResource(item, record);
    }

    return record;
  }

  /**
   * Generate an array of Generatable items or primitive values. If the content
   * property is set to null, an empty array will be returned.
   */
  private generateArray(item: GenerateArray, cache: Unknown): ArrayType[] {
    if (item.content === null) {
      return [];
    }

    const length: number = this.rng(item.minItems ?? 1, item.maxItems ?? 10);
    const content: ArrayType[] = [].constructor(length).fill(null).map((_, index: number) => {
      if (item.content instanceof GeneratePrimitive) {
        return this.generatePrimitive(item.content);
      }

      if (item.content instanceof GenerateObject) {
        item.content.key = '';

        const has: Generatable = item.content.content.find((nested) => nested.key === item.autoIncrement);
        if (has) {
          const indexOf: number = item.content.content.indexOf(has);
          item.content.content[indexOf] = new GenerateCustom({ key: has.key, value: index });
        }
      }

      return this.generateItem(item.content as Generatable, {});
    }) as ArrayType[];

    if (item.key && item.key !== '') {
      cache[item.key] = content;
    }

    return this.sortArray(item, content);
  }

  /**
   * Generate a primitive value using the content of the given item parameter,
   * or use the custom generator function supplied.
   */
  private generatePrimitive(item: GeneratePrimitive): string | number | boolean {
    if (item.custom) {
      return item.custom(this);
    }

    return this.generatorSwitch(item.content, this.cache) as string | number | boolean;
  }

  /**
   * Sort the content of the array if needed, based on the value of the sortKey
   * or the primitive values in the array.
   */
  private sortArray(item: GenerateArray, content: ArrayType[]): ArrayType[] {
    if (!item.sort) {
      return content;
    }

    const asc: boolean = item.sortDirection === 'asc';
    if (item.content instanceof GeneratePrimitive) {
      return content.sort((a, b) => ((a as StringInt) < (b as StringInt) ? -1 : 1) * (asc ? 1 : -1));
    }

    if (item.sortKey) {
      // Check if one of the sortKey associated values is a primitive.
      const isPrimitive: boolean = content.some((check) => {
        // Skip if null.
        if (check === null) {
          return false;
        }
        const value: unknown = (check as Unknown)[item.sortKey as string] as unknown;
        return typeof value === 'string'
          || typeof value === 'number'
          || typeof value === 'boolean'
          || typeof value === 'bigint';
      });

      return isPrimitive ? content : content.sort(
        (a, b) => ((a as StringInt) < (b as StringInt) ? -1 : 1) * (asc ? 1 : -1),
      );
    }

    return content;
  }
}
