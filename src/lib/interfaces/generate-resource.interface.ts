/**
 * JsonLd resource creation options.
 *
 * - `prefix` First part of the path for the `@id` tag.
 *
 * - `suffix` Second part of the path for the `@id` tag.
 *
 * - `type` The `@type` value. Defaults to 'GenerateObject'.
 *
 * - `uuid` Insert a custom UUID value.
 */
export interface GenerateResource {
  // What to add before the `@id` UUID value.
  prefix?: string;
  // What to append to the `@id` UUID value.
  suffix?: string;
  // The `@type` value.
  type?: string;
  // If already set, like for a subresource, the UUID value.
  uuid?: string;
}
