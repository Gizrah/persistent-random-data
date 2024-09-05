/*
 * The module, the public services and classes.
 */
export { Extractor } from './lib/extractor.class';
export { Generator } from './lib/generator.class';
export { TtPersistenceModule } from './lib/tt-persistence.module';
export { TtPersistenceService } from './lib/tt-persistence.service';
export { TtPersistenceStateService } from './lib/tt-persistence-state.service';

/**
 * Interfaces
 */
export * from './lib/interfaces/generate-resource.interface';
export * from './lib/interfaces/generate-collection.interface';
export * from './lib/interfaces/retrieve-options.interface';
export * from './lib/interfaces/tt-persistence-config.interface';
export * from './lib/interfaces/tt-persistence-delete-result.interface';
export * from './lib/interfaces/tt-persistence-index-trigger.interface';
export * from './lib/interfaces/tt-persistence-joiner.interface';
export * from './lib/interfaces/tt-persistence-options.interface';
export * from './lib/interfaces/tt-persistence-result.interface';
export * from './lib/interfaces/tt-persistence-route-delete.interface';
export * from './lib/interfaces/tt-persistence-route-filter.interface';
export * from './lib/interfaces/tt-persistence-route-get.interface';
export * from './lib/interfaces/tt-persistence-route-map.interface';
export * from './lib/interfaces/tt-persistence-route-post.interface';
export * from './lib/interfaces/tt-persistence-route-put.interface';
export * from './lib/interfaces/tt-persistence-route-state.interface';

/**
 * Enums
 */
export * from './lib/interfaces/tt-delete-cascade.enum';
export * from './lib/interfaces/tt-persistence-request-option.enum';

/**
 * Types
 */
export {
  Generatable,
  GeneratableString,
  TtFilterCallback,
  TtPersistenceFormatter,
  TtPersistenceCombiner,
  TtPersistenceRouteFilterFunction,
} from './lib/interfaces/shared.type';

/**
 * Models
 */
export * from './lib/models/generate-array.model';
export * from './lib/models/generate-base.model';
export * from './lib/models/generate-boolean.model';
export * from './lib/models/generate-custom.model';
export * from './lib/models/generate-date.model';
export * from './lib/models/generate-email.model';
export * from './lib/models/generate-number.model';
export * from './lib/models/generate-object.model';
export * from './lib/models/generate-phone.model';
export * from './lib/models/generate-primitive.model';
export * from './lib/models/generate-text.model';
export * from './lib/models/generate-uuid.model';
export * from './lib/models/generate-word.model';
export * from './lib/models/tt-persistence-config.model';

/**
 * Error models
 */
export * from './lib/errors/formatter-missing.error';
export * from './lib/errors/generatable-key-not-found.error';
export * from './lib/errors/indexeddb-access.error';
export * from './lib/errors/indexeddb-add.error';
export * from './lib/errors/indexeddb-delete.error';
export * from './lib/errors/formatter-missing.error';
export * from './lib/errors/indexeddb-store.error';
export * from './lib/errors/indexeddb-unsupported.error';
export * from './lib/errors/no-primary-key-in-object.error';
export * from './lib/errors/no-primary-key-in-settings.error';
export * from './lib/errors/no-primary-key-in-url.error';
export * from './lib/errors/trigger-not-found.error';
export * from './lib/errors/word-retry-overflow.error';
