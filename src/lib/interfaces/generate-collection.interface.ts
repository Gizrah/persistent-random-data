/**
 * Hydra+JsonLd Collection settings. The `type` value will default to
 * `hydra:Collection` instead of `GenerateObject` if not set.
 *
 * - `prefix` First part of the path for the `@id` tag.
 *
 * - `suffix` Second part of the path for the `@id` tag.
 *
 * - `type` The `@type` value. Defaults to 'GenerateObject'.
 *
 * - `uuid` generates a UUID between the prefix and suffix in the `@id` tag.
 *
 * @inheritDoc
 */
export interface GenerateCollection {
  // What to add before the `@id` UUID value.
  prefix?: string;
  // What to append to the `@id` UUID value.
  suffix?: string;
  // The `@type` value.
  type?: string;
  // Generate a UUID between the prefix and suffix properties?
  uuid?: boolean;
}
