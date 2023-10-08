import {
  Attribute,
  AttributeMap,
  InternalAttribute,
  lookupAttributeInMap,
} from './attrs-and-props';

export class Solution {
  private satisfyingAssignment: boolean[];
  private fromInternal: Attribute[];
  private proxy: { [attribute: Attribute]: boolean };
  private trueAttributesCache: null | string[] = null;

  constructor(
    satisfyingAssignment: boolean[],
    toInternal: AttributeMap<InternalAttribute>,
    fromInternal: Attribute[],
  ) {
    this.satisfyingAssignment = satisfyingAssignment;
    this.fromInternal = fromInternal;
    this.proxy = new Proxy(
      {},
      {
        get(_: { [attribute: Attribute]: boolean }, attribute: Attribute) {
          const internal = lookupAttributeInMap(`${attribute}`, toInternal);
          if (internal >= satisfyingAssignment.length) {
            throw new Error(
              `Attribute '${attribute}' was defined after this solution was generated`,
            );
          }
          return satisfyingAssignment[internal];
        },
      },
    );
  }

  /**
   * Return all the attributes that have been assigned true in the solution (in sorted order)
   */
  get trueAttributes(): string[] {
    if (this.trueAttributesCache === null) {
      this.trueAttributesCache = this.satisfyingAssignment
        .map((val, i) => (val ? i : null))
        .filter((x): x is number => x !== null && x > 0)
        .map((i) => this.fromInternal[i])
        .filter((x) => x !== '')
        .sort();
    }
    return this.trueAttributesCache;
  }

  /** Provides a read-only dictionary for looking up the value of all attributes */
  get lookup(): { [attribute: Attribute]: boolean } {
    return this.proxy;
  }
}
