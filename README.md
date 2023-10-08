# BatSAT 🦇

[![Coverage Status](https://coveralls.io/repos/github/robsimmons/batsat/badge.svg?branch=main)](https://coveralls.io/github/robsimmons/batsat?branch=main)

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

  // Cats, and only cats, live in the catlands
  p.equal([`home ${c} catlands`], [`species ${c} cat`]);
}

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

console.log(p.values); // This will be null because solve() hasn't been called
p.solve();
console.log(p.values); // Something like ["species celeste cat", ...]
```

<!-- TSDOC_START -->

## :factory: Problem

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
- [predicate](#gear-predicate)

#### :gear: quantify

Require that some number of arguments be true.

| Method     | Type                                                         |
| ---------- | ------------------------------------------------------------ |
| `quantify` | `(min: number, max: number, propositions: string[]) => void` |

Parameters:

- `min`: Minimum number of arguments that must be true (inclusive)
- `max`: Maximum number of arguments that must be true (inclusive)

#### :gear: exactly

Require that exactly a given number of the arguments be true.

`p.exactly(n, [a, b, c...])` is equivalent to `p.quantify(n, n, [a, b, c...])`

| Method    | Type                                          |
| --------- | --------------------------------------------- |
| `exactly` | `(n: number, propositions: string[]) => void` |

Parameters:

- `n`: The number of arguments from the list that must be true

#### :gear: all

Require that all arguments be true.

`p.all([a, b, c])` is equivalent to `p.quantify(3, 3, [a, b, c])` or
`p.exactly(3, [a, b, c])`

| Method | Type                               |
| ------ | ---------------------------------- |
| `all`  | `(propositions: string[]) => void` |

#### :gear: atLeast

Require that some non-zero number of arguments be true

`p.atLeast(n, [a, b, c, d])` is equivalent to `p.quantify(n, 4, [a, b, c, d])`

| Method    | Type                                            |
| --------- | ----------------------------------------------- |
| `atLeast` | `(min: number, propositions: string[]) => void` |

Parameters:

- `min`: The minimum number of arguments that must be true (inclusive)

#### :gear: atMost

Require that at most some number of arguments be true

`p.atMost(n, [a, b, c])` is equivlanet to `p.quantify(0, n, [a, b, c])`

| Method   | Type                                            |
| -------- | ----------------------------------------------- |
| `atMost` | `(max: number, propositions: string[]) => void` |

Parameters:

- `max`: The maximum number of arguments that must be true (inclusive)

#### :gear: unique

Require that exactly one of the arguments be true.

`p.unique(a, b, c...)` is equivlanet to `p.exactly(1, a, b, c...)`

| Method   | Type                               |
| -------- | ---------------------------------- |
| `unique` | `(propositions: string[]) => void` |

#### :gear: inconsistent

Marks two propositions as inconsistent

| Method         | Type                             |
| -------------- | -------------------------------- |
| `inconsistent` | `(a: string, b: string) => void` |

#### :gear: implies

Indicates that the premise or premises imply the conclusion:
if the premise(s) hold(s), the conclusion must also hold.

An array of premises is treated as conjunction: `p.implies([a, b, c], d)`
logically means `(a /\ b /\ c) -> d`.

Leaves open the possibility that the conclusion must be true even if all
premises are false. If you only want `d` to be true if there's some reason
for it to be true, you want to use `rule()`, not `implies()`.

| Method    | Type                                               |
| --------- | -------------------------------------------------- |
| `implies` | `(premises: string[], conclusion: string) => void` |

Parameters:

- `premises`: A conjuctive list of premises
- `conclusion`: A proposition that must be true if premises are

#### :gear: equal

Requires two conjuctive formulas to have the same truth value.

An array is treated as conjunction: `p.equal([a, b], [c, d, e])` logically
means `(a /\ b) <-> (c /\ d /\ e)`.

| Method  | Type                                 |
| ------- | ------------------------------------ |
| `equal` | `(a: string[], b: string[]) => void` |

Parameters:

- `a`: A conjuctive list of propositions
- `b`: A conjuctive list of propositions

#### :gear: assert

Assert that a single fact must be true.

| Method   | Type                  |
| -------- | --------------------- |
| `assert` | `(a: string) => void` |

#### :gear: rule

Indicates that the conclusion (the "head" of the rule) is defined
by its premise. If the premise(s) hold(s), the conclusion must also hold,
and if the conclusion holds, then the truth of that conclusion must be
derivable via some rule for which the premise holds.

(It's the second part, the fact that the conclusion must be derivable
from some premise that holds, which makes Rule different from Implies,
aside from them facing the opposite direction.)

An array of premises is treated as conjunction: `p.rule(a, [b, c, d])`
logically means that `(b /\ c /\ d) -> a` and that, if `a` holds,
either `(b /\ c /\ d)` OR the premises of some other rule that has
`a` as its conclusion must hold.

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

Attempt to satisfy all the constraints descibed so far

| Method  | Type         |
| ------- | ------------ |
| `solve` | `() => void` |

#### :gear: predicate

Declares a new predicate.

To create a new atom that takes no arguments, you can write
something like `p.predicate('q')` or `p.predicate('q', [])`. Both mean
the same thing: they declare a predicate `q` that takes no
arguments.

To specify a predicate that does take arguments, you must
describe the _domain_ of those arguments. For instance, if
you wanted to describe some cats and their colors, so that
you could say `colored celeste gray` and `colored terra orange`,
then you'd declare a predicate `colored` like this:

```
let cast = ['celeste', 'nimbus', 'terra'];
let color = ['gray', 'black', 'white', 'orange'];
p.predicate('colored', [cast, color]);
```

| Method      | Type                                        |
| ----------- | ------------------------------------------- |
| `predicate` | `(name: string, args?: string[][]) => void` |

Parameters:

- `name`: The name of the predicate.
- `args`: The domains of the argument.

<!-- TSDOC_END -->
