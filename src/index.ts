import { Solution } from './Solution';
import {
  Attribute,
  AttributeMap,
  IDENT_REGEX,
  InternalAttribute,
  InternalProposition,
  Proposition,
  lookupAttributeInMap,
} from './attrs-and-props';

type Assignment = boolean[];
type Clause = InternalProposition[];
type Constraint = { lo: number; hi: number; clause: Clause }; // Inclusive bounds

/**
 * Problems are the primary engine of BatSAT. You use a problem to declare attributes,
 * attach constraints, and generate solutions.
 */
export class Problem {
  /**
   * Maps from InternalAttribute to Attributes. Internal-only attributes map to the
   * empty string.
   */
  private fromInternal: Attribute[] = [''];

  /** Maps from a Attribute to InternalAttribute. */
  private toInternal: AttributeMap<InternalAttribute> = {};

  private constraints: Constraint[] = [];

  /**
   * If an attribute is defined by a set of rules, we have to keep track of every rule
   * of that can justify that attribute in order to implement iff-completion.
   */
  private rules: { [head: InternalAttribute]: InternalProposition[] } = {};

  /**
   * Checkpoint to allow removal of any extra constraints added for iff-completion
   */
  private nonRuleConstraints: null | number = null;

  /**
   * The reset() function must be called before new constraints are added.
   */
  private reset() {
    if (this.nonRuleConstraints !== null) {
      this.constraints = this.constraints.slice(0, this.nonRuleConstraints);
    }
    this.nonRuleConstraints = null;
  }

  /**
   * Lookup a proposition. The attribute contained in the proposition should
   * already exist (an exception will be throw if it does not).
   */
  private lookup(prop: Proposition): InternalProposition {
    const [sign, attribute] = prop[0] === '!' ? [-1, prop.slice(1)] : [1, prop];
    return sign * lookupAttributeInMap(attribute, this.toInternal);
  }

  /**
   * Require that some number of arguments be satisfied
   *
   * @param min Minimum number of arguments that must be satisfied (inclusive)
   * @param max Maximum number of arguments that must be satisfied (inclusive)
   */
  quantify(min: number, max: number, propositions: Proposition[]) {
    if (!(0 <= max && Math.ceil(min) <= Math.floor(max) && min <= propositions.length)) {
      throw new Error(
        `quantify(${min}, ${max}, args) with ${propositions.length} arguments is unsatisfiable`,
      );
    }
    if (min <= 0 && max >= propositions.length) {
      throw new Error(
        `quantify(${min}, ${max}, args) with ${propositions.length} arguments is always trivially satisfied`,
      );
    }

    const clause = propositions.map((arg) => this.lookup(arg));
    this.reset();
    this.constraints.push({
      clause,
      lo: Math.max(0, Math.ceil(min)),
      hi: Math.min(propositions.length, Math.floor(max)),
    });
  }

  /**
   * Require that exactly a given number of the arguments be satisfied
   *
   * `p.exactly(n, [a, b, c...])` is equivalent to `p.quantify(n, n, [a, b, c...])`
   *
   * @param n The number of arguments from the list that must be satisfied
   */
  exactly(n: number, propositions: Proposition[]) {
    if (!(0 <= n && n <= propositions.length && Math.round(n) === n)) {
      throw new Error(`exactly(${n}, args) with ${propositions.length} arguments is unsatisfiable`);
    }
    if (propositions.length === 0) {
      throw new Error(`exactly(0, []) is always trivially satisfied`);
    }

    this.quantify(n, n, propositions);
  }

  /**
   * Require that all arguments be satisfied
   *
   * `p.all([a, b, c])` is equivalent to `p.quantify(3, 3, [a, b, c])` or
   * `p.exactly(3, [a, b, c])`
   */
  all(propositions: Proposition[]) {
    if (propositions.length === 0) {
      throw new Error(`all([]) is always trivially satisfied`);
    }

    this.quantify(propositions.length, propositions.length, propositions);
  }

  /**
   * Require that some non-zero number of arguments be satisfied
   *
   * `p.atLeast(n, [a, b, c, d])` is equivalent to `p.quantify(n, 4, [a, b, c, d])`
   *
   * @param min The minimum number of arguments that must be satisfied (inclusive)
   */
  atLeast(min: number, propositions: Proposition[]) {
    if (min > propositions.length) {
      throw new Error(
        `atLeast(${min}, args) with ${propositions.length} arguments is unsatisfiable`,
      );
    }
    if (min <= 0) {
      throw new Error(`atLeast(0, args) always trivially satisfied`);
    }

    this.quantify(min, propositions.length, propositions);
  }

  /**
   * Require that at most some number of arguments be satisfied
   *
   * `p.atMost(n, [a, b, c])` is equivalent to `p.quantify(0, n, [a, b, c])`
   *
   * @param max The maximum number of arguments that must be satisfied (inclusive)
   */
  atMost(max: number, propositions: Proposition[]) {
    if (max < 0) {
      throw new Error(`atMost(${max}, args) is unsatisfiable`);
    }
    if (max >= propositions.length) {
      throw new Error(`atMost(${max}, args) with ${propositions.length} arguments is always trivially satisfied`);
    }

    this.quantify(0, max, propositions);
  }

  /**
   * Require that exactly one of the arguments be satisfied
   *
   * `p.unique(a, b, c...)` is equivlanet to `p.exactly(1, a, b, c...)`
   */
  unique(propositions: Proposition[]) {
    if (propositions.length === 0) {
      throw new Error(`unique([]) is unsatisfiable`);
    }

    this.quantify(1, 1, propositions);
  }

  /**
   * Require that two propositions not be simultaneously satisfied
   */
  inconsistent(a: Proposition, b: Proposition) {
    this.atMost(1, [a, b]);
  }

  /**
   * Indicates that the premise or premises imply the conclusion:
   * if all premises are satisfied, the conclusion must be satisfied.
   *
   * An array of premises is treated as conjunction: `p.implies([a, b, c], d)`
   * logically means `(a /\ b /\ c) -> d`.
   *
   * Leaves open the possibility that the conclusion may be satisfied even if some
   * premises are unsatisfied. If that's not what you want --- if you only want `d`
   * to be satisfied if there's some rule that gives a reason for it to be satisfied,
   * you want to use `rule()` instead of `implies()`.
   *
   * @param premises A conjuctive list of premises
   * @param conclusion A proposition that must be satisfied if premises are
   */
  implies(premises: Proposition[], conclusion: Proposition) {
    const conc = this.lookup(conclusion);
    const prems = premises.map((prem) => -this.lookup(prem));
    const clause = [...prems, conc];

    this.reset();
    this.constraints.push({
      clause,
      lo: 1,
      hi: clause.length,
    });
  }

  private iff(premises: InternalAttribute[], conclusion: InternalAttribute) {
    // conclusion implies, in turn, each premise
    this.constraints.push(
      ...premises.map((premise) => ({
        clause: [premise, -conclusion],
        lo: 1,
        hi: 2,
      })),
    );
    // premises imply conclusion
    const clause = [...premises.map((prem) => -prem), conclusion];
    this.constraints.push({
      clause,
      lo: 1,
      hi: clause.length,
    });
  }

  /**
   * Requires two conjuctive formulas be equal: either both are satisfied or
   * neither are satisfied. (This is also called an if-and-only-if relationship.)
   *
   * An array is treated as conjunction: `p.equal([a, b], [c, d, e])` logically
   * means `(a /\ b) <-> (c /\ d /\ e)`.
   *
   * @param a A conjuctive list of propositions
   * @param b A conjuctive list of propositions
   *
   */
  equal(a: Proposition[], b: Proposition[]) {
    if (a.length === 0 && b.length === 0) {
      throw new Error('equal([], []) is vacuous');
    }
    if (a.length === 0) {
      this.all(b);
      return;
    }
    if (b.length === 0) {
      this.all(a);
      return;
    }

    this.reset();
    if (a.length === 1) {
      if (b.length === 1) {
        const literalA = this.lookup(a[0]);
        const literalB = this.lookup(b[0]);
        this.constraints.push(
          { lo: 1, hi: 2, clause: [literalA, -literalB] },
          { lo: 1, hi: 2, clause: [-literalA, literalB] },
        );
      } else {
        const premises = b.map((x) => this.lookup(x));
        const conclusion = this.lookup(a[0]);
        this.iff(premises, conclusion);
      }
    } else {
      if (b.length === 1) {
        const premises = a.map((x) => this.lookup(x));
        const conclusion = this.lookup(b[0]);
        this.iff(premises, conclusion);
      } else {
        let hiddenPred = this.generate();
        let conjunctA = a.map((x) => this.lookup(x));
        let conjunctB = b.map((x) => this.lookup(x));
        this.iff(conjunctA, hiddenPred);
        this.iff(conjunctB, hiddenPred);
      }
    }
  }

  /**
   * Assert that a single proposition must be satisfied.
   */
  assert(a: Proposition) {
    this.all([a]);
  }

  /**
   * Indicates that the attribute in the conclusion (the "head" of the rule) is
   * defined by this rule (and every other rule that has the attribute at the head).
   * If all premises are satisfied, the conclusion must be assigned `true`,
   * and if the conclusion is assigned `true`, then that must be justified
   * derivable via some rule that defines the conclusion, for which the premise holds.
   *
   * It's the second part, the fact that the conclusion must be derivable
   * from some premise that holds, which makes `rule()` different from `implies()`.
   * They also "point" in opposite directions.
   *
   * An array of premises is treated as conjunction: `p.rule(a, [b, c, d])`
   * logically means that `(b /\ c /\ d) -> a` and that, if `a` is assigned `true`,
   * either `(b /\ c /\ d)` is satisfied OR the premises of some other rule that has
   * `a` as its conclusion is satisfied.
   *
   * @param conclusion The head of the rule (must not be negated)
   * @param premises A conjuctive list of premises
   */
  rule(conclusion: Attribute, premises: Proposition[]) {
    const conc = this.lookup(conclusion);
    const prems = premises.map((p) => this.lookup(p));
    if (conc < 0) {
      throw new Error(`Conclusion '${conclusion}' of a rule must not be negated`);
    }
    this.implies(premises, conclusion);

    // Add iff-completion
    if (!this.rules[conc]) {
      this.rules[conc] = [];
    }
    if (premises.length === 0) {
      this.rules[conc].push(0);
    } else if (premises.length === 1) {
      this.rules[conc].push(prems[0]);
    } else {
      const standin = this.generate();
      this.iff(prems, standin);
      this.rules[conc].push(standin);
    }
  }

  /**
   * Check whether an assignment is satisfied given the current constraints.
   *
   * Returns `null` if the assignment satisfies all constraints, and otherwise
   * returns a suggestion for which predicate should be flipped if we want to greedily
   * search for a single assignment flip that leaves the most clauses satisfied.
   */
  private satisfies(assignment: Assignment) {
    function lookup(assignment: Assignment, literal: InternalProposition) {
      return literal < 0 ? !assignment[-literal] : assignment[literal];
    }

    const suggestionMap = assignment.map(() => 0);
    let clausesSatisfied = this.constraints.reduce((accum, { lo, hi, clause }) => {
      let numLiteralsInClauseSatisfied = clause.reduce(
        (accum, literal) => (lookup(assignment, literal) ? accum + 1 : accum),
        0,
      );

      if (lo <= numLiteralsInClauseSatisfied && numLiteralsInClauseSatisfied <= hi) {
        if (lo === numLiteralsInClauseSatisfied) {
          for (const literal of clause) {
            if (lookup(assignment, literal)) {
              suggestionMap[Math.abs(literal)] -= 1;
            }
          }
        }

        if (hi === numLiteralsInClauseSatisfied) {
          for (const literal of clause) {
            if (!lookup(assignment, literal)) {
              suggestionMap[Math.abs(literal)] -= 1;
            }
          }
        }

        return accum + 1;
      }

      if (numLiteralsInClauseSatisfied === lo - 1) {
        // Flipping any _unsat_ literal would make this clause _satisfied_
        for (const literal of clause) {
          if (!lookup(assignment, literal)) {
            suggestionMap[Math.abs(literal)] += 1;
          }
        }
      }

      if (numLiteralsInClauseSatisfied === hi + 1) {
        // Flipping any _satisfied_ literal would make this clause _satisfied_
        for (const literal of clause) {
          if (lookup(assignment, literal)) {
            suggestionMap[Math.abs(literal)] += 1;
          }
        }
      }

      return accum;
    }, 0);

    if (clausesSatisfied === this.constraints.length) {
      return null;
    }

    let best: InternalAttribute[] = [];
    let bestNum = 0;
    for (let i = 1; i < suggestionMap.length; i++) {
      if (suggestionMap[i] === bestNum) {
        best.push(i);
      }
      if (suggestionMap[i] > bestNum) {
        best = [i];
      }
    }

    return {
      clausesSatisfied,
      suggestion: best[Math.floor(Math.random() * best.length)],
    };
  }

  /** Print current constraints to the console */
  showConstraints() {
    this.constraints.map(({ lo, hi, clause }, i) => {
      let num =
        hi >= clause.length
          ? `at least ${lo}`
          : lo === hi
          ? `exactly ${lo}`
          : lo === 0
          ? `at most ${hi}`
          : `between ${lo} and ${hi}`;
      let lits = clause
        .map((lit) => {
          let litName = this.fromInternal[Math.abs(lit)];
          if (litName === '') litName = `__#${Math.abs(lit)}__`;
          if (lit === 0) litName = `TRUE`;
          return lit < 0 ? `!${litName}` : litName;
        })
        .join(', ');
      console.log(`Clause ${i}, requires ${num} of ${lits}`);
    });
  }

  /**
   * Attempt to find an assignment that will satisfy all the currently-declared constraints.
   *
   * Throws an exception if enough iterations go by without finding a satisfying assignment.
   */
  solve(): Solution {
    if (this.nonRuleConstraints === null) {
      this.nonRuleConstraints = this.constraints.length;

      this.constraints.push(
        ...Object.entries(this.rules).map(([head, possibleJustifications]) => {
          return {
            lo: 1,
            hi: possibleJustifications.length + 1,
            clause: [-parseInt(head), ...possibleJustifications],
          };
        }),
      );
    }

    // this.showConstraints();

    const assignment: Assignment = this.fromInternal.map(() => Math.random() >= 0.5);
    assignment[0] = true;
    let noise = 0;
    let result = this.satisfies(assignment);
    let windowSize = Math.max(3, Math.ceil(this.constraints.length / 6));
    let window: number[] = [];
    for (let i = 0; i < windowSize; i++) {
      window.push(0);
    }

    let iteration = 0;
    let failsafe = 50000;
    while (result !== null) {
      // console.log(assignment);
      if (Math.random() > noise) {
        /* console.log(
          `${result.clausesSatisfied} clauses satisfied, greedily flipping ${
            this.fromInternal[result.suggestion]
          }. (Noise ${noise})`,
        ); */
        assignment[result.suggestion] = !assignment[result.suggestion];
      } else {
        const guess = 1 + Math.floor(Math.random() * (assignment.length - 1));
        /* console.log(
          `${result.clausesSatisfied} clauses satisfied, randomly flipping ${this.fromInternal[guess]}. (Noise ${noise})`,
        ); */
        assignment[guess] = !assignment[guess];
      }

      // Should we change the noise? (Variation of Hoos 2002)
      if (window.every((clausesSatisfied) => clausesSatisfied >= result!.clausesSatisfied)) {
        noise = noise + (1 - noise) * 0.2;
      } else {
        noise = noise - noise * 0.05;
      }
      window[iteration % windowSize] = result.clausesSatisfied;

      result = this.satisfies(assignment);
      iteration += 1;
      failsafe -= 1;
      if (failsafe === 0) {
        throw new Error('Timeout');
      }
    }

    for (let i = 0; i < assignment.length; i++) {
      if (this.fromInternal[i] !== '' && assignment[i]) {
        //console.log(`${this._preds[i]} - ${assignment[i]}`);
      }
    }

    return new Solution(assignment, this.toInternal, this.fromInternal);
  }

  /**
   * Invariant: if an Attribute is given as an argument, it must be valid, in
   * canonical form, and must not already exist. Only the `predicate()`
   * method calls the `generate()` method with an argument.
   *
   * With no argument, this creates an internal-only predicate, and is used
   * to create new temporaries.
   */
  private generate(prop?: Attribute): InternalAttribute {
    const newLiteral = this.fromInternal.length;
    this.fromInternal.push(prop || '');
    return newLiteral;
  }

  /**
   * Declares a new attribute.
   *
   * To create a new attribute that takes no arguments, you can write
   * something like `p.attribute('q')` or `p.attribute('q', [])`. Both mean
   * the same thing: they declare a predicate `q` that takes no
   * arguments.
   *
   * To specify a predicate that does take arguments, you must
   * describe the *domain* of those arguments. For instance, if
   * you wanted to describe some cats and their colors, so that
   * you could have attributes like `colored celeste gray` and
   * `colored terra orange`, then you'd declare a predicate `colored` like
   * this:
   *
   * ```
   * let cast = ['celeste', 'nimbus', 'terra'];
   * let color = ['gray', 'black', 'white', 'orange'];
   * p.predicate('colored', [cast, color]);
   * ```
   *
   * @param name The name of the predicate
   * @param args The domains of the argument
   */
  attribute(name: string, args: string[][] = []) {
    const arity = args.length;
    if (arity >= 4) {
      throw new Error(`No current support for predicate '${name}' with arity ${arity}`);
    }
    if (!name.match(IDENT_REGEX)) {
      throw new Error(
        `Predicate '${name}' must start with a lowercase letter and contain only alphanumeric characters and _`,
      );
    }
    for (let domain of args) {
      for (let member of domain) {
        if (!member.match(IDENT_REGEX)) {
          throw new Error(
            `Element '${member}' must start with a lowercase letter and contain only alphanumeric characters and _`,
          );
        }
      }
    }

    if (this.toInternal[name]) {
      let existingArity = this.toInternal[name].findIndex((x) => x !== undefined);
      if (existingArity !== -1) {
        throw new Error(
          `Cannot declare ${name} (with ${arity} argument${
            arity === 1 ? '' : 's'
          }) when ${name} (with ${existingArity} argument${
            existingArity === 1 ? '' : 's'
          }) was previously declared`,
        );
      }
    }
    this.toInternal[name] = [undefined, undefined, undefined, undefined];

    switch (arity) {
      case 0: {
        this.toInternal[name][0] = this.generate(name);
        return;
      }
      case 1: {
        const map: { [arg: string]: number } = {};
        this.toInternal[name][1] = map;
        for (const x of args[0]) {
          map[x] = this.generate(`${name} ${x}`);
        }
        return;
      }
      case 2: {
        const map: { [arg: string]: { [arg: string]: number } } = {};
        this.toInternal[name][2] = map;
        for (const x of args[0]) {
          map[x] = {};
          for (const y of args[1]) {
            map[x][y] = this.generate(`${name} ${x} ${y}`);
          }
        }
        return;
      }
      case 3: {
        const map: {
          [arg: string]: { [arg: string]: { [arg: string]: number } };
        } = {};
        this.toInternal[name][3] = map;
        for (const x of args[0]) {
          map[x] = {};
          for (const y of args[1]) {
            map[x][y] = {};
            for (const z of args[2]) {
              map[x][y][z] = this.generate(`${name} ${x} ${y} ${z}`);
            }
          }
        }
        return;
      }
    }
  }
}
