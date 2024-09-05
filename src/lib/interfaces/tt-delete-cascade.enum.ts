/**
 * Deleting an objectStore can be done with several cascading options. The value
 * can be changed, the entire object can be deleted or kept, for each cascading
 * parent object's nested object value.
 */
export enum TtDeleteCascade {
  // Set property field content to null.
  NULL = 'OVERWRITE_AS_NULL',
  // Set property field content to undefined.
  UNDEFINED = 'OVERWRITE_AS_UNDEFINED',
  // Delete the property and its content.
  DELETE = 'DELETE_PROPERTY',
  // Don't cascade.
  KEEP = 'KEEP_PROPERTY',
}
