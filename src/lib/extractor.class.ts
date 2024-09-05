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
import { Generator } from './generator.class';

export type BaseKeyMap = Map<string, Generatable | BaseKeyMap>;
export type KeyMapType = Generatable | BaseKeyMap;

/**
 * Extractor options allow for Generatable objects to be set for certain nested
 * properties, JsonLd types and/or recurring keys.
 */
export interface ExtractorOptions {
  // Specify the generation options for a specific, nested, key.
  keyMap?: Map<string, KeyMapType>;
  // Specify the generation options for a specific '@type'.
  typeMap?: Map<string, GenerateObject>;
  // Specify the generation for a recurring key.
  globalKeyMap?: Map<string, Generatable>;
}

//noinspection JSMethodCanBeStatic
/**
 * Extract and generate random data based on the inputted data and the given
 * options object. Options use the Generator class' Generate models for specific
 * keys or JsonLd types.
 */
export class Extractor {

  /**
   * Generator class to generate the content with.
   */
  public readonly generator: Generator = new Generator();

  /**
   * RegExp to check if a string value is an email address.
   */
  private emailRegExp: RegExp = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}])|(([a-zA-Z\-\d]+\.)+[a-zA-Z]{2,}))$/i, // eslint-disable-line
  );

  /**
   * RegExp to check if (part of) a string is a UUID.
   */
  private uuidRegExp: RegExp = new RegExp(
    /[\da-fA-F]{8}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{4}\b-[\da-fA-F]{12}/i,
  );

  /**
   * A date regexp that checks if one of the default date formats is found, one
   * of `yyyy-MM-dd`/`yyyyMMdd` or `dd-MM-yyyy`
   */
  private dateRegExp: RegExp = new RegExp(
    /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}|^\d{4}-?(0[1-9]|1[0-2])-?(0[1-9]|[12]\d|3[01])/i,
  );

  /**
   * Simple regexp to determine if a string is potentially a phone number.
   */
  private phoneNumberRegExp: RegExp = new RegExp(/^[+]*[(]?\d{1,4}[)]?[-\s./\d]*$/i);

  /**
   * Simple regexp to check if a string value is a boolean in disguise.
   */
  private booleanRegExp: RegExp = new RegExp(/^(true|false)$/i);

  /**
   * Regexp for a single word.
   */
  private wordRegExp: RegExp = new RegExp(/^\S+$/, 'g');

  /**
   * Sentence regexp that matches the combination of a word with a period,
   * exclamation mark or question mark.
   */
  private sentenceRegExp: RegExp = new RegExp(/(\S+[.!?])/, 'gm');

  /**
   * Paragraph regexp that checks for line ends and new lines.
   */
  private paragraphRegExp: RegExp = new RegExp(/(\S+[.!?][\n\r])/, 'gm');

  /**
   * Local storage of the extractor options.
   */
  private options: ExtractorOptions;

  /**
   * Extract the given data for the types of values to generate using default
   * values and/or the supplied options. If options are previously set, those
   * will be reused unless overwritten specifically.
   */
  public extract(data: Unknown | Unknown[], options?: ExtractorOptions): unknown {
    this.options = {
      keyMap: options?.keyMap ?? new Map(),
      typeMap: options?.typeMap ?? new Map(),
      globalKeyMap: options?.globalKeyMap ?? new Map(),
    };

    if (Array.isArray(data)) {
      return this.generator.generate(this.parseArray(data, undefined, this.options.keyMap));
    }

    const asObject: Generatable = this.parseObject(data, undefined, this.options.keyMap);
    const generated: Unknown = this.generator.generate(asObject);

    if (this.isHydra(data)) {
      generated['hydra:totalItems'] = (generated['hydra:member'] as Unknown[])?.length ?? 0;
    }

    return generated;
  }

  /**
   * Parse an object by its entries. Certain property types are parsed slightly
   * different to accommodate JsonLd and/or Hydra content.
   */
  //eslint-disable-next-line complexity
  public parseObject(value: Unknown, key?: string, keyMap?: KeyMapType): Generatable {
    const generated: GenerateObject = new GenerateObject({ key: key as string, content: [] });
    const asMap: BaseKeyMap = this.createBaseKeyMap(value, key, keyMap);

    for (const [property, content] of Object.entries(value)) {
      const parsed: Generatable = this.parseKeyType(property, content, asMap);
      generated.content.push(parsed);
    }

    return generated;
  }

  /**
   * Check the record for the type of number to generate. The number is first
   * cast as a regular integer and those values are used as the minimum and
   * maximum values to generate between (e.g. 1000 - 9999). If the number is a
   * float, the fractional values are converted to the Faker precision value.
   */
  public extractNumber(key: string, value: string): Generatable {
    const float: number = parseFloat(value);
    const generate: GenerateNumber = new GenerateNumber({ key: key });
    if (float.toString() !== value.toString() || isNaN(float)) {
      return generate;
    }
    // Convert to integer, generate min/max values based on string length.
    const asInt: number = parseInt(value as string, 10);
    generate.min = parseInt([].constructor(String(asInt).length)
      .fill(0)
      .map((int: number, index: number) => (index === 0 ? 1 : 0)).join(''),10);
    generate.max = parseInt([].constructor(String(asInt).length).fill(9).join(''), 10);

    if (!Number.isInteger(float)) {
      // Use the string length of values after `.` and divide 1 by 10^x.
      const fractional: number = String(float).split('.')[1].length;
      generate.precision = 1 / Math.pow(10, fractional);
    }

    return generate;
  }

  /**
   * Switch the typeof value and call the correct extract function.
   */
  private extractorSwitch(key: string, value: unknown, keyMap?: KeyMapType): Generatable {
    switch (true) {
      case typeof value === 'number':
      case typeof value === 'bigint':
        return this.extractNumber(key, String(value));
      case typeof value === 'string':
        return this.extractString(key, value as string);
      case typeof value === 'boolean':
        return new GenerateBoolean({ key: key });
      case value === null:
        return new GenerateCustom({ key: key, value: value });
      case Array.isArray(value):
        return this.parseArray(value as Unknown[], key, keyMap);
      case typeof value === 'object':
        return this.parseObject(value as Unknown, key, keyMap);
      default:
        return new GenerateCustom({ key: key, value: value });
    }
  }

  /**
   * Parse an array and check if the content is a primitive value or an object.
   * For primitive values, the GeneratePrimitive is used, for objects, the keys
   * are parsed for each objects in the array and checked for different types of
   * values or nullable values and creates a GenerateObject accordingly.
   */
  private parseArray(value: Unknown[], key?: string, keyMap?: KeyMapType): Generatable {
    const options: Generatable = this.findGeneratableForKey(key) as Generatable;
    let generated: GenerateArray = new GenerateArray({
      key: key as string,
      content: null,
      minItems: Math.ceil(value.length / 2),
      maxItems: value.length + Math.ceil(value.length / 3),
    });

    if (options instanceof GenerateArray) {
      generated = new GenerateArray({ ...options });
      const defaultMin: number = this.definedOrFallback(options.minItems, Math.ceil(value.length / 2));
      const defaultMax: number = this.definedOrFallback(options.maxItems, value.length + Math.ceil(value.length / 3));
      const [min, max] = this.generator.minMax(defaultMin, defaultMax);
      generated.minItems = min;
      generated.maxItems = max;
    }

    generated = this.parseArrayEmptyValues(generated, value) as GenerateArray;
    for (const item of value) {
      if (generated.content) {
        break;
      }

      if (item === null || item === undefined) {
        continue;
      }

      generated.content = typeof item === 'object'
        ? this.parseArrayObjectEntries(value, keyMap)
        : this.parseArrayValue(item);
    }

    return generated;
  }

  /**
   * Check if there are null or undefined values in the array and adjust the
   * `allow` and `percentage` options for either in the Generatable.
   */
  private parseArrayEmptyValues(generated: Generatable, value: unknown[]): Generatable {
    const undefinedCount: number = value.filter((item) => item === undefined).length;
    const nullCount: number = value.filter((item) => item === null).length;

    if (undefinedCount && generated.allowOptional !== false) {
      generated.allowOptional = true;
      generated.percentageOptional = (undefinedCount / value.length) * 100;
    }

    if (nullCount && generated.allowNull !== false) {
      generated.allowNull = true;
      generated.percentageNull = (nullCount / value.length) * 100;
    }

    return generated;
  }

  /**
   * Check the typeof primitive array value and return a GeneratePrimitive
   * object with the right content.
   */
  private parseArrayValue(value: unknown): GeneratePrimitive {
    const generated: GeneratePrimitive = new GeneratePrimitive();
    switch (typeof value) {
      case 'bigint':
      case 'number':
        generated.content = this.extractNumber('null', String(value));
        break;
      case 'boolean':
        generated.content = new GenerateBoolean({ key: 'null' });
        break;
      case 'string':
      default:
        generated.content = this.extractString('null', String(value));
        break;
    }

    return generated;
  }

  /**
   * Reduce the array of objects to a single object with an array of all the
   * different values found across all objects in the initial array and return
   * a GenerateObject based on the combined data.
   */
  private parseArrayObjectEntries(value: Unknown[], keyMap?: KeyMapType): Generatable {
    const allValues: Record<string, unknown[]> = value.reduce((
      combined: Record<string, unknown[]>,
      item: Unknown,
      index: number,
    ) => {
      for (const [property, content] of Object.entries(item)) {
        if (!combined[property]) {
          combined[property] = [].constructor(value.length).fill(undefined);
        }

        combined[property][index] = content;
      }

      return combined;
    }, {}) as Record<string, unknown[]>;

    const reduced: Generatable[] = Object.keys(allValues)
      .map((property) => {
        const asMap: BaseKeyMap = this.createBaseKeyMap(allValues, property, keyMap);
        return this.parseArrayObjectPropertyContent(property, allValues[property], asMap);
      });

    return new GenerateObject({ key: null as never, content: reduced });
  }

  /**
   * Check the content of the various values for the given key and assign a
   * Generatable for the first non-null, non-undefined match.
   */
  private parseArrayObjectPropertyContent(key: string, value: unknown[], keyMap?: KeyMapType): Generatable {
    let generated: Generatable | undefined;
    for (const item of value) {
      if (generated) {
        break;
      }

      if (item === undefined || item === null) {
        continue;
      }

      generated = this.parseKeyType(key, item, keyMap);
    }

    generated = generated || new GenerateCustom({ key: key, value: undefined });
    generated = this.parseArrayEmptyValues(generated, value);

    return generated as Generatable;
  }

  /**
   * Creates a BaseKeyMap based off the various options and parameters.
   * The map with generatables is first created from the global map,
   * {@see ExtractorOptions.globalKeyMap}. If the options also has a typeMap,
   * {@see ExtractorOptions.typeMap}, the globalMap is overwritten. If the
   * keyMap parameter is a generatable, the object is added to the map.
   */
  private createBaseKeyMap(value: Unknown, key?: string, keyMap?: KeyMapType): BaseKeyMap {
    let asMap: BaseKeyMap = keyMap instanceof Map ? keyMap : new Map();

    if (key && this.options?.globalKeyMap?.has(key)) {
      const global: Generatable = this.options.globalKeyMap.get(key) as Generatable;
      if (global instanceof GenerateObject) {
        asMap = new Map(global.content.map((item) => [item.key, item]));
      }
    }

    if (this.checkObjectIsType(value)) {
      const valueArray: string[] = value['@type'] as string[];
      const singleType: string = Array.isArray(valueArray) ? valueArray[0] : valueArray;
      const forType: GenerateObject = this.options.typeMap?.get(singleType as string) as GenerateObject;
      asMap = new Map(forType.content.map((item) => [item.key, item]));
    }

    if (typeof keyMap === 'object' && !(keyMap instanceof Map) && keyMap.hasOwnProperty('key')) {
      asMap.set(keyMap.key, keyMap as Generatable);
    }

    return asMap;
  }

  /**
   * Check if the key is one of the known non-default ones and return a
   * different Generatable based on matching cases.
   */
  private parseKeyType(key: string, value: unknown, keyMap?: KeyMapType): Generatable {
    const asMap: BaseKeyMap | undefined = keyMap instanceof Map ? keyMap : undefined;

    if (key === '@type' || key === '@context') {
      return new GenerateCustom({ key: key, value: value });
    }

    if (key.startsWith('hydra:') && key !== 'hydra:member') {
      return new GenerateCustom({ key: key, value: value });
    }

    if (asMap && asMap.has(key) && !(asMap.get(key) instanceof Map)) {
      return asMap.get(key) as Generatable;
    }

    return this.extractorSwitch(key, value, asMap);
  }

  /**
   * Check for RegExp patterns in the string to match certain conditions for
   * generation.
   */
  //eslint-disable-next-line complexity
  private extractString(key: string, value: string): Generatable {
    switch (true) {
      case this.uuidRegExp.test(value):
        return this.extractUuid(key, value);
      case this.dateRegExp.test(value):
        return this.extractDate(key, value);
      case this.emailRegExp.test(value):
        return new GenerateEmail({ key: key });
      case this.phoneNumberRegExp.test(value):
        return this.extractPhoneNumber(key, value);
      case this.booleanRegExp.test(value):
        return new GenerateBoolean({ key: key });
      default:
        break;
    }

    if (this.wordRegExp.test(value)) {
      return this.extractWord(key, value);
    }

    if (this.paragraphRegExp.test(value)) {
      return this.extractText(key, value);
    }

    const wordCount: number = value.match(this.sentenceRegExp)?.length ?? 0;
    if (wordCount) {
      return wordCount > 1 ? this.extractParagraph(key, value) : this.extractSentence(key, value);
    }

    return new GenerateWord({ key: key });
  }

  /**
   * Extract the build-up of the UUID in a string, so if it is an IRI, the parts
   * before and after the IRI are properly extracted.
   */
  public extractUuid(key: string, value: string): Generatable {
    const parts: string[] = value.split('/');
    let prefix: string = '';
    let suffix: string = '';
    let foundUuid: boolean = false;

    for (const part of parts) {
      const isUuid: boolean = this.uuidRegExp.test(part);
      if (!foundUuid && isUuid) {
        foundUuid = isUuid;
      }

      if (isUuid) {
        continue;
      }

      if (!foundUuid) {
        prefix += part + '/';
      } else {
        suffix += '/' + part;
      }
    }

    return new GenerateUuid({
      key: key,
      prefix: prefix,
      suffix: suffix,
    });
  }

  /**
   * Check the way the given date is built up and create a GenerateDate object
   * with the right format.
   */
  private extractDate(key: string, value: string): Generatable {
    const time: string = this.extractTime(value);
    let format: string;
    switch (true) {
      case /\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/g.test(value):
        format = 'yyyyMMdd';
        break;
      case /(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}/g.test(value):
        format = 'dd-MM-yyyy';
        break;
      case /\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/g.test(value):
      default:
        format = 'yyyy-MM-dd';
        break;
    }

    return new GenerateDate({ key: key, format: format + time });
  }

  /**
   * Extract the time format, including milliseconds, the timezone as-is and the
   * ISO separator (or space if not T). Returns a date-fns format for the time.
   */
  //eslint-disable-next-line complexity
  private extractTime(value: string): string {
    const matched: string[] = (value.match(/[^+-]*/gi) ?? [value, '']);
    const matchedDate: string = matched[matched.length - 2];
    const isIso: boolean = matchedDate.includes('T');
    const colonCount: number = (matchedDate.match(/:/g) ?? []).length;
    const timezone: string = (value.match(/[+-](\d{2}:\d{2}|\d{4})/i) ?? [''])[0];

    let time: string = '';

    switch (colonCount) {
      case 3:
        const colons: string[] = value.split(':');
        const fractions: number = colons[colons.length - 1].length;
        time = (isIso ? 'T' : ' ') + 'HH:mm:ss:' + [].constructor(fractions).fill('S').join('');
        break;
      case 2:
        time = (isIso ? 'T' : ' ') + 'HH:mm:ss';
        break;
      case 1:
        time = (isIso ? 'T' : ' ') + 'HH:mm';
        break;
      default:
        break;
    }

    return time + timezone;
  }

  /**
   * Create an GeneratePhoneNumber object and format the phone number quickly by
   * replacing digits with pound signs that will be used to create random
   * digits.
   */
  private extractPhoneNumber(key: string, value: string): Generatable {
    return new GeneratePhoneNumber({ key: key, format: value.replace(/\d/g, '#') });
  }

  /**
   * Create a GenerateWord based on the length of the given string value and
   * check if it is a capital letter at the start of the word. Generation
   * parameters are min: length / 2, max: length + length / 3, both rounded up.
   */
  private extractWord(key: string, value: string): Generatable {
    return new GenerateWord({
      key: key,
      minLength: Math.ceil(value.length / 2),
      maxLength: value.length + Math.ceil(value.length / 3),
      capitalize: /^[A-Z]/.test(value),
    });
  }

  /**
   * Check the amount of paragraphs and create a random min/max blocks value for
   * creating a Lorem Ipsum text. Generation parameters are min: length / 2,
   * max: length + length / 3, both rounded up.
   */
  private extractText(key: string, value: string): Generatable {
    const totalBlocks: number = (value.match(/[\r\n]/g) ?? []).length;
    return new GenerateText({
      key: key,
      minBlocks: Math.ceil(totalBlocks / 2),
      maxBlocks: totalBlocks + Math.ceil(totalBlocks / 3),
    });
  }

  /**
   * Check the amount of sentences and create a random min/max sentence length
   * value for creating a Lorem Ipsum paragraph. Generation parameters are
   * min: length / 2, max: length + length / 3, both rounded up.
   */
  private extractParagraph(key: string, value: string): Generatable {
    const totalSentences: number = (value.match(/\.{1,3}/g) ?? []).length;
    return new GenerateText({
      key: key,
      minSentences: Math.ceil(totalSentences / 2),
      maxSentences: totalSentences + Math.ceil(totalSentences / 3),
    });
  }

  /**
   * Check the amount of words in the sentence and create a random min/max word
   * count value for creating a Lorem Ipsum sentence. Generation parameters are
   * min: length / 2, max: length + length / 3, both rounded up.
   */
  private extractSentence(key: string, value: string): Generatable {
    const totalWords: number = (value.match(/\b/g) ?? ['', '']).length - 2;
    return new GenerateText({
      key: key,
      minWords: Math.ceil(totalWords / 2),
      maxWords: totalWords + Math.ceil(totalWords / 3),
    });
  }

  /**
   * Simple check to see if the given object is a Hydra collection object.
   */
  private isHydra(object: object): boolean {
    return typeof object === 'object' && 'hydra:member' in object;
  }

  /**
   * Simple check to see if the given object is a JsonLd resource object.
   */
  private isJsonLd(object: object): boolean {
    return typeof object === 'object' && '@type' in object;
  }

  /**
   * Check if the object is a JsonLd object, and thus has the `@type` property,
   * and check if the typeMap, if available, has the given type value as a
   * predefined Generatable.
   */
  private checkObjectIsType(value: Unknown): boolean {
    if (!this.isJsonLd(value)) {
      return false;
    }

    const valueArray: string[] = value['@type'] as string[];
    const singleType: string = Array.isArray(valueArray) ? valueArray[0] : valueArray;
    return this.options.typeMap?.has(singleType) ?? false;
  }

  /**
   * Return only the Generatable match for the given key in any of the options'
   * maps, starting with the keyMap, followed by the globalKeyMap and finally
   * the typeMap.
   */
  private findGeneratableForKey(key?: string): Generatable | undefined {
    if (!key) {
      return;
    }

    const keyMap: KeyMapType | undefined = this.options?.keyMap?.get(key);
    if (keyMap && !(keyMap instanceof Map)) {
      return keyMap as Generatable;
    }

    const globalMap: Generatable | undefined = this.options?.globalKeyMap?.get(key);
    if (globalMap) {
      return globalMap;
    }

    return this.options?.typeMap?.get(key);
  }

  /**
   * Check if the comparative number is a number and equal to or larger than
   * zero, or default to the nonZero number.
   */
  private definedOrFallback(defined: number | undefined, fallback: number): number {
    if (typeof defined === 'number' && defined >= 0) {
      return defined;
    }

    return fallback;
  }

}
