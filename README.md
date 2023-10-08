# BatSAT 🦇

[![Coverage Status](https://coveralls.io/repos/github/robsimmons/batsat/badge.svg?branch=main)](https://coveralls.io/github/robsimmons/batsat?branch=main)
[![NPM Module](https://img.shields.io/npm/v/batsat.svg)](https://www.npmjs.com/package/batsat)

BatSAT is a declarative language embedded in JavaScript intended for
procedural content generation.
It aims to reimplement Ian Douglas Horswill's
[CatSAT](https://github.com/ianhorswill/CatSAT) library, which
implements similar functionality in C#.

BatSAT is currently GPL licensed, but if that licensing ends up being
an obstacle for you, let me know!

# Documentation

A solver is created by creating a new `Problem`. Constraints
and rules must be written in terms of previously-defined predicates.

Here's an example script that will assign species and homes
for four characters:

```typescript
import { Problem } from 'batsat';

const p = new Problem();
const cast = ['celeste', 'nimbus', 'luna', 'terra'];
const species = ['cat', 'dog'];
const home = ['uplands', 'lowlands', 'catlands', 'doghouse'];

p.predicate('species', [cast, species]);
p.predicate('home', [cast, home]);

for (const c of cast) {
  p.unique(species.map((s) => `species ${c} ${s}`));
  p.unique(home.map((h) => `home ${c} ${h}`));

  // Only dogs live in the doghouse (but dogs can live elsewhere)
  p.implies([`home ${c} doghouse`], `species ${c} dog`);
}

// Luna and terra must live in different places
for (const h of home) {
  p.inconsistent(`home luna ${h}`, `home terra ${h}`);
}

// If Celeste is a cat, she must live in the catlands
p.equal([`species celeste cat`], [`home celeste catlands`]);

// There need to be 1 or 2 uplanders
p.quantify(
  1,
  2,
  cast.map((c) => `home ${c} uplands`),
);

// There's only room for one in the doghouse
p.atMost(
  1,
  cast.map((c) => `home ${c} doghouse`),
);

const s = p.solve();
s.trueAttributes; // Something like ["species celeste cat", ...]
s.lookup['species celeste cat']; // Maybe true, maybe false
s.lookup['species celeste cat'] === s.lookup['home celeste catlands']; // Definitely true
```

<!-- TSDOC_START -->

## :factory: Problem

Problems are the primary engine of BatSAT. You use a problem to declare attributes,
attach constraints, and generate solutions.

### Methods

- [quantify](#gear-quantify)
- [exactly](#gear-exactly)
- [all](#gear-all)
- [atLeast](#gear-atleast)
- [atMost](#gear-atmost)
- [unique](#gear-unique)
- [inconsistent](#gear-inconsistent)
- [implies](#gear-implies)
- [equal](#gear-equal)
- [assert](#gear-assert)
- [rule](#gear-rule)
- [showConstraints](#gear-showconstraints)
- [solve](#gear-solve)
- [attribute](#gear-attribute)

#### :gear: quantify

Require that some number of arguments be satisfied

| Method     | Type                                                         |
| ---------- | ------------------------------------------------------------ |
| `quantify` | `(min: number, max: number, propositions: string[]) => void` |

Parameters:

- `min`: Minimum number of arguments that must be satisfied (inclusive)
- `max`: Maximum number of arguments that must be satisfied (inclusive)

#### :gear: exactly

Require that exactly a given number of the arguments be satisfied

`p.exactly(n, [a, b, c...])` is equivalent to `p.quantify(n, n, [a, b, c...])`

| Method    | Type                                          |
| --------- | --------------------------------------------- |
| `exactly` | `(n: number, propositions: string[]) => void` |

Parameters:

- `n`: The number of arguments from the list that must be satisfied

#### :gear: all

Require that all arguments be satisfied

`p.all([a, b, c])` is equivalent to `p.quantify(3, 3, [a, b, c])` or
`p.exactly(3, [a, b, c])`

| Method | Type                               |
| ------ | ---------------------------------- |
| `all`  | `(propositions: string[]) => void` |

#### :gear: atLeast

Require that some non-zero number of arguments be satisfied

`p.atLeast(n, [a, b, c, d])` is equivalent to `p.quantify(n, 4, [a, b, c, d])`

| Method    | Type                                            |
| --------- | ----------------------------------------------- |
| `atLeast` | `(min: number, propositions: string[]) => void` |

Parameters:

- `min`: The minimum number of arguments that must be satisfied (inclusive)

#### :gear: atMost

Require that at most some number of arguments be satisfied

`p.atMost(n, [a, b, c])` is equivalent to `p.quantify(0, n, [a, b, c])`

| Method   | Type                                            |
| -------- | ----------------------------------------------- |
| `atMost` | `(max: number, propositions: string[]) => void` |

Parameters:

- `max`: The maximum number of arguments that must be satisfied (inclusive)

#### :gear: unique

Require that exactly one of the arguments be satisfied

`p.unique(a, b, c...)` is equivlanet to `p.exactly(1, a, b, c...)`

| Method   | Type                               |
| -------- | ---------------------------------- |
| `unique` | `(propositions: string[]) => void` |

#### :gear: inconsistent

Require that two propositions not be simultaneously satisfied

| Method         | Type                             |
| -------------- | -------------------------------- |
| `inconsistent` | `(a: string, b: string) => void` |

#### :gear: implies

Indicates that the premise or premises imply the conclusion:
if all premises are satisfied, the conclusion must be satisfied.

An array of premises is treated as conjunction: `p.implies([a, b, c], d)`
logically means `(a /\ b /\ c) -> d`.

Leaves open the possibility that the conclusion may be satisfied even if some
premises are unsatisfied. If that's not what you want --- if you only want `d`
to be satisfied if there's some rule that gives a reason for it to be satisfied,
you want to use `rule()` instead of `implies()`.

| Method    | Type                                               |
| --------- | -------------------------------------------------- |
| `implies` | `(premises: string[], conclusion: string) => void` |

Parameters:

- `premises`: A conjuctive list of premises
- `conclusion`: A proposition that must be satisfied if premises are

#### :gear: equal

Requires two conjuctive formulas be equal: either both are satisfied or
neither are satisfied. (This is also called an if-and-only-if relationship.)

An array is treated as conjunction: `p.equal([a, b], [c, d, e])` logically
means `(a /\ b) <-> (c /\ d /\ e)`.

| Method  | Type                                 |
| ------- | ------------------------------------ |
| `equal` | `(a: string[], b: string[]) => void` |

Parameters:

- `a`: A conjuctive list of propositions
- `b`: A conjuctive list of propositions

#### :gear: assert

Assert that a single proposition must be satisfied.

| Method   | Type                  |
| -------- | --------------------- |
| `assert` | `(a: string) => void` |

#### :gear: rule

Indicates that the attribute in the conclusion (the "head" of the rule) is
defined by this rule (and every other rule that has the attribute at the head).
If all premises are satisfied, the conclusion must be assigned `true`,
and if the conclusion is assigned `true`, then that must be justified
derivable via some rule that defines the conclusion, for which the premise holds.

It's the second part, the fact that the conclusion must be derivable
from some premise that holds, which makes `rule()` different from `implies()`.
They also "point" in opposite directions.

An array of premises is treated as conjunction: `p.rule(a, [b, c, d])`
logically means that `(b /\ c /\ d) -> a` and that, if `a` is assigned `true`,
either `(b /\ c /\ d)` is satisfied OR the premises of some other rule that has
`a` as its conclusion is satisfied.

| Method | Type                                               |
| ------ | -------------------------------------------------- |
| `rule` | `(conclusion: string, premises: string[]) => void` |

Parameters:

- `conclusion`: The head of the rule (must not be negated)
- `premises`: A conjuctive list of premises

#### :gear: showConstraints

Print current constraints to the console

| Method            | Type         |
| ----------------- | ------------ |
| `showConstraints` | `() => void` |

#### :gear: solve

Attempt to find an assignment that will satisfy all the currently-declared constraints.

Throws an exception if enough iterations go by without finding a satisfying assignment.

| Method  | Type             |
| ------- | ---------------- |
| `solve` | `() => Solution` |

#### :gear: attribute

Declares a new attribute.

To create a new attribute that takes no arguments, you can write
something like `p.attribute('q')` or `p.attribute('q', [])`. Both mean
the same thing: they declare a predicate `q` that takes no
arguments.

To specify a predicate that does take arguments, you must
describe the _domain_ of those arguments. For instance, if
you wanted to describe some cats and their colors, so that
you could have attributes like `colored celeste gray` and
`colored terra orange`, then you'd declare a predicate `colored` like
this:

```
let cast = ['celeste', 'nimbus', 'terra'];
let color = ['gray', 'black', 'white', 'orange'];
p.predicate('colored', [cast, color]);
```

| Method      | Type                                        |
| ----------- | ------------------------------------------- |
| `attribute` | `(name: string, args?: string[][]) => void` |

Parameters:

- `name`: The name of the predicate
- `args`: The domains of the argument

<!-- TSDOC_END -->

## :factory: Solution

Solutions are returned the solve() method of a problem.

### Fields

- [trueAttributes](#gear-trueAttributes)
- [lookup](#gear-lookup)

#### :gear: trueAttributes

Holds all the attributes that have been assigned true in the solution (in sorted order).

Type: `string[]`

#### :gear: lookup

A read-only map from attributes to their values.

Type: `{ [attribute: string]: boolean }`
