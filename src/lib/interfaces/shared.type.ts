import { HttpRequest } from '@angular/common/http';
import { Injector } from '@angular/core';
import { OperatorFunction } from 'rxjs';
import { GenerateArray } from '../models/generate-array.model';
import { GenerateBoolean } from '../models/generate-boolean.model';
import { GenerateCustom } from '../models/generate-custom.model';
import { GenerateDate } from '../models/generate-date.model';
import { GenerateEmail } from '../models/generate-email.model';
import { GenerateNumber } from '../models/generate-number.model';
import { GenerateObject } from '../models/generate-object.model';
import { GeneratePhoneNumber } from '../models/generate-phone.model';
import { GenerateText } from '../models/generate-text.model';
import { GenerateUuid } from '../models/generate-uuid.model';
import { GenerateWord } from '../models/generate-word.model';
import { ParentLink } from './parent-link.interface';
import { PersistenceOptionsTrigger } from './persistence-options-trigger.interface';
import { TtPersistenceOptions } from './tt-persistence-options.interface';

export type Unknown = Record<string, unknown>;

export type Generatable =
  GenerateNumber
  | GeneratableString
  | GenerateBoolean
  | GeneratePhoneNumber
  | GenerateArray
  | GenerateObject
  | GenerateCustom;
export type GeneratableString = GenerateWord | GenerateText | GenerateUuid | GenerateDate | GenerateEmail;

export type QueueMap = Map<string, Unknown[]>;
export type StorageMap = Map<string, Map<string, boolean>>;
export type StringMap = Map<string, string>;
export type LinkMap = Map<string, StringMap>;
export type OptionsMap = Map<string, TtPersistenceOptions>;
export type TriggerMap = Map<string, PersistenceOptionsTrigger>;
export type StoreTriggerMap = Map<string, Map<string, PersistenceOptionsTrigger>>;
export type LinkArray = [string, [string, string][]][];
export type OperatorUnknown = OperatorFunction<Unknown[], Unknown[]>;
export type ParentLinkMap = Map<string, ParentLink>;

/**
 * Callback type.
 */
export type TtFilterCallback<T> = (result: T, request?: HttpRequest<T>) => boolean;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Default formatter definition, with access to the injector, which allows for
 * getting data from any service. Also has the current HttpRequest object
 * available to extract a UUID or HttpParam. Lastly the output, which changes
 * depending on the method:
 *
 * - `GET`: The retrieved data object.
 * - `PUT` and `PATCH`: The data object as is currently in storage.
 * - `POST`: Nothing, since no data is stored yet.
 */
export type TtPersistenceFormatter<T = any> = (injector: Injector, request: HttpRequest<T> | T, output: any) => any;

/**
 * Formatter definition for formatters that handle data retrieved from the
 * objectStore and POST, PUT or PATCH data. Returned data is used to update the
 * chain.
 */
export type TtPersistenceCombiner<T = any, K = any> = (injector: Injector, payload: T | K, stored: K) => Promise<any>;

/**
 * Filter function as used by the TtPersistenceRetrieveService that is used by
 * the parser to match content. With the HttpRequest accessible, the filter can
 * be applied to specific UUIDs or other matching content.
 */
export type TtPersistenceRouteFilterFunction<T = any> = (
  item: T,
  request: HttpRequest<T>,
) => boolean;
