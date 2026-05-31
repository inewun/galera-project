/** HAL link as returned by the OpenProject API. */
export interface HalLink {
  href: string | null;
  title?: string;
}

/** A HAL collection resource with pagination metadata and embedded items. */
export interface HalCollection<T> {
  _embedded: {
    elements: T[];
  };
  total: number;
  count: number;
  pageSize: number;
  offset: number;
}

/**
 * Raw work package element returned by the OpenProject API.
 * Detailed typed mapping will be introduced in a later step (DTO layer).
 */
export type WorkPackageElement = Record<string, any>;

/** Raw project element – same flexible shape for now. */
export type ProjectElement = Record<string, any>;
