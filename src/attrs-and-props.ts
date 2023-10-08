/**
 * Attributes are the things that are assigned a value (truth or falsehood) in the system.
 *
 * Examples: `a`, `sees tim falcon`, `dead warrior`
 *
 * The strings `a`, `sees` and `dead` are **Predicates**. In the examples above,
 * the `sees` predicate requires two arguments, `tim` and `falcon`, and the `dead`
 * predicate requires one argument, `warrior`.
 */
export type Attribute = string;
export type InternalAttribute = number; // Int, > 0 (0 is a synoynm for True)

/**
 * A Proposition is either an an attribute --- like `p` or `hasSword warrior` --- or its
 * negation --- like `!p` or `!hasSword warrior`.
 *
 * The proposition `hasSword warror` is satsfied when `hasSword warror` is assigned the
 * value `true`, and the proposition `!hasSword warror` is satsfied when the attribute
 * attribute `hasSword warror` is assigned the value `false`.
 */
export type Proposition = string;
/**
 * If the attribute `hasSword warror` maps to the internal attribute 17, then the proposition
 * `hasSword warror` maps to 17 and the proposition `!hasSword warror` maps to -17.
 */
export type InternalProposition = number; // Either a predicate or the negation of a predicate

export type AttributeMap<T> = {
  [pred: string]: [
    undefined | T,
    undefined | { [arg: string]: T },
    undefined | { [arg: string]: { [arg: string]: T } },
    undefined | { [arg: string]: { [arg: string]: { [arg: string]: T } } },
  ];
};

export const IDENT_REGEX = /^[a-z][A-Za-z0-9_]*$/;

export function lookupAttributeInMap<T>(attribute: Attribute, map: AttributeMap<T>): T {
  const [predicate, ...args] = attribute.split(' ');
  if (!predicate.match(IDENT_REGEX)) {
    throw new Error(
      `Predicate '${predicate}' in attribute '${attribute}' is not a well-formed predicate. Predicates must start with a lowercase letter and contain only alphanumeric characters and underscores.`,
    );
  }
  for (const arg of args) {
    if (!arg.match(IDENT_REGEX)) {
      throw new Error(
        `Argument '${arg}' in attribute '${attribute}' is not a well-formed argument. Arguments must start with a lowercase letter and contain only alphanumeric characters and underscores.`,
      );
    }
  }
  const attributeMap = map[predicate];
  if (!attributeMap || attributeMap.every((x) => x === undefined)) {
    throw new Error(`No predicate '${predicate}' declared`);
  }

  function wrongArityError() {
    const arity = attributeMap.findIndex((x) => x !== undefined);
    return new Error(
      `Atom '${attribute}' seems to have ${args.length} argument${
        args.length === 1 ? '' : 's'
      }, but '${predicate}' expects ${arity} argument${arity === 1 ? '' : 's'}`,
    );
  }

  function invalidArgumentError(position: number, arg: string) {
    return new Error(
      `Argument #${position} of '${predicate}' is '${arg}', which is not a valid argument in this position`,
    );
  }

  switch (args.length) {
    case 0:
      if (!attributeMap[0]) throw wrongArityError();
      return attributeMap[0];
    case 1:
      if (!attributeMap[1]) throw wrongArityError();
      if (!attributeMap[1][args[0]]) throw invalidArgumentError(1, args[0]);
      return attributeMap[1][args[0]];
    case 2:
      if (!attributeMap[2]) throw wrongArityError();
      if (!attributeMap[2][args[0]]) throw invalidArgumentError(1, args[0]);
      if (!attributeMap[2][args[0]][args[1]]) throw invalidArgumentError(2, args[1]);
      return attributeMap[2][args[0]][args[1]];
    case 3:
      if (!attributeMap[3]) throw wrongArityError();
      if (!attributeMap[3][args[0]]) throw invalidArgumentError(1, args[0]);
      if (!attributeMap[3][args[0]][args[1]]) throw invalidArgumentError(2, args[1]);
      if (!attributeMap[3][args[0]][args[1]][args[2]]) throw invalidArgumentError(3, args[2]);
      return attributeMap[3][args[0]][args[1]][args[2]];

    /* istanbul ignore next: should be impossible */
    default:
      throw new Error(
        `Cannot handle arity ${args.length} for ${attribute} (internal error, this should be impossible!)`,
      );
  }
}
