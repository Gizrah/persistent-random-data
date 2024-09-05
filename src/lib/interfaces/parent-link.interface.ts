/**
 * Interface for the recursive update and/or deletion of objectStores, to make
 * it easier to determine the child, parent and self.
 */
export interface ParentLink {
  storeName: string;
  childStoreName: string;
  property: string;
  idKey: string;
  parentStoreName?: string;
}
