type Assignment = boolean[];
type Clause = InternalProposition[];
type Constraint = { lo: number; hi: number; clause: Clause }; // Inclusive bounds

function lookup(assignment: Assignment, literal: InternalProposition) {
  return literal < 0 ? !assignment[-literal] : assignment[literal];
}

/**
 * Atoms are the things that are assigned truth or falsehood in the system.
 *
 * Examples: `a`, `sees tim falcon`, `dead warrior`
 *
 * The strings `a`, `sees` and `dead` are **Predicates**. In the examples above,
 * the `sees` predicate requires two arguments, `tim` and `falcon`, and the `dead`
 * predicate requires one argument, `warrior`.
 */
export type Atom = string;
type InternalAtom = number; // Int, > 0 (0 is a synoynm for True)

/**
 * A Proposition is either an atom --- like `p` or `hasSword warrior` --- or its
 * negation --- like `!p` or `!hasSword warrior`.
 */
export type Proposition = string;
type InternalProposition = number; // Either a predicate or the negation of a predicate

const IDENT_REGEX = /^[a-z][A-Za-z0-9_]*$/;

export class Problem {
  /** Maps from InternalAtom to Atom. Internal-only atoms are the empty string. */
  private fromInternal: Atom[] = [''];

  /** Maps from a (parsed) Atom to InternalAtom. */
  private toInternal: {
    [pred: string]: [
      undefined | InternalAtom,
      undefined | { [arg: string]: InternalAtom },
      undefined | { [arg: string]: { [arg: string]: InternalAtom } },
      undefined | { [arg: string]: { [arg: string]: { [arg: string]: InternalAtom } } },
    ];
  } = {};

  private _rules: { [head: InternalAtom]: InternalProposition[] } = {};
  private _constraints: Constraint[] = [];

  /**
   * The solution of a solved Problem. null if Solve hasn't successfully returned.
   * Must have the same length as fromInternal.
   */
  private satisfyingAssignment: null | boolean[] = null;

  /**
   * Solving produces extra
   */
  private nonRuleConstraints: null | number = null;

  private reset() {
    if (this.nonRuleConstraints !== null) {
      this._constraints = this._constraints.slice(0, this.nonRuleConstraints);
    }
    this.satisfyingAssignment = null;
    this.nonRuleConstraints = null;
  }

  /**
   * Lookup a proposition, which is expected to already exist, in the toInternal array.
   * Throw an exception if it doesn't exist.
   */
  private lookup(prop: Proposition): InternalProposition {
    const [sign, atom] = prop[0] === '!' ? [-1, prop.slice(1)] : [1, prop];
    const [predicate, ...args] = atom.split(' ');
    if (!predicate.match(IDENT_REGEX)) {
      throw new Error(
        `Predicate '${predicate}' in atom '${atom}' is not a well-formed predicate. Predicates must start with a lowercase letter and contain only alphanumeric characters and underscores.`,
      );
    }
    for (const arg of args) {
      if (!arg.match(IDENT_REGEX)) {
        throw new Error(
          `Argument '${arg}' in atom '${atom}' is not a well-formed argument. Arguments must start with a lowercase letter and contain only alphanumeric characters and underscores.`,
        );
      }
    }
    if (!this.toInternal[predicate] || this.toInternal[predicate].every((x) => x === undefined)) {
      throw new Error(`No predicate '${predicate}' declared`);
    }
    const arity = this.toInternal[predicate].findIndex((x) => x !== undefined);
    if (!this.toInternal[predicate][args.length]) {
      throw new Error(
        `Atom '${atom}' has ${args.length} argument${
          args.length === 1 ? '' : 's'
        }, but ${predicate} expects ${arity} argument${arity === 1 ? '' : 's'}`,
      );
    }

    let result: number | undefined;
    switch (args.length) {
      case 0:
        result = this.toInternal[predicate][0];
        break;
      case 1:
        result = this.toInternal[predicate][1]?.[args[0]];
        break;
      case 2:
        result = this.toInternal[predicate][2]?.[args[0]]?.[args[1]];
        break;
      case 3:
        result = this.toInternal[predicate][3]?.[args[0]]?.[args[1]]?.[args[2]];
        break;
      /* istanbul ignore next: should be impossible */
      default:
        throw new Error(
          `Cannot handle arity ${args.length} for ${atom} (internal error, this should be impossible!)`,
        );
    }
    if (!result) {
      throw new Error(`Atom '${atom}' not declared`);
    }
    return sign * result;
  }

  /**
   * Require that some number of arguments be true.
   *
   * @param min Minimum number of arguments that must be true (inclusive)
   * @param max Maximum number of arguments that must be true (inclusive)
   */
  quantify(min: number, max: number, propositions: Proposition[]) {
    if (!(0 <= max && Math.ceil(min) <= Math.floor(max) && min <= propositions.length)) {
      throw new Error(
        `quantify(${min}, ${max}, args) with ${propositions.length} arguments is unsatisfiable`,
      );
    }
    if (min <= 0 && max >= propositions.length) {
      throw new Error(
        `quantify(${min}, ${max}, args) with ${propositions.length} arguments is always true`,
      );
    }

    const clause = propositions.map((arg) => this.lookup(arg));
    this.reset();
    this._constraints.push({
      clause,
      lo: Math.max(0, Math.ceil(min)),
      hi: Math.min(propositions.length, Math.floor(max)),
    });
  }

  /**
   * Require that exactly a given number of the arguments be true.
   *
   * `p.exactly(n, [a, b, c...])` is equivalent to `p.quantify(n, n, [a, b, c...])`
   *
   * @param n The number of arguments from the list that must be true
   */
  exactly(n: number, propositions: Proposition[]) {
    if (!(0 <= n && n <= propositions.length && Math.round(n) === n)) {
      throw new Error(`exactly(${n}, args) with ${propositions.length} arguments is unsatisfiable`);
    }
    if (propositions.length === 0) {
      throw new Error(`exactly(0, []) is always true`);
    }

    this.quantify(n, n, propositions);
  }

  /**
   * Require that all arguments be true.
   *
   * `p.all([a, b, c])` is equivalent to `p.quantify(3, 3, [a, b, c])` or
   * `p.exactly(3, [a, b, c])`
   */
  all(propositions: Proposition[]) {
    if (propositions.length === 0) {
      throw new Error(`all([]) is always true`);
    }

    this.quantify(propositions.length, propositions.length, propositions);
  }

  /**
   * Require that some non-zero number of arguments be true
   *
   * `p.atLeast(n, [a, b, c, d])` is equivalent to `p.quantify(n, 4, [a, b, c, d])`
   *
   * @param min The minimum number of arguments that must be true (inclusive)
   */
  atLeast(min: number, propositions: Proposition[]) {
    if (min > propositions.length) {
      throw new Error(
        `atLeast(${min}, args) with ${propositions.length} arguments is unsatisfiable`,
      );
    }
    if (min <= 0) {
      throw new Error(`atLeast(0, args) always true`);
    }

    this.quantify(min, propositions.length, propositions);
  }

  /**
   * Require that at most some number of arguments be true
   *
   * `p.atMost(n, [a, b, c])` is equivlanet to `p.quantify(0, n, [a, b, c])`
   *
   * @param max The maximum number of arguments that must be true (inclusive)
   */
  atMost(max: number, propositions: Proposition[]) {
    if (max < 0) {
      throw new Error(`atMost(${max}, args) is unsatisfiable`);
    }
    if (max >= propositions.length) {
      throw new Error(`atMost(${max}, args) with ${propositions.length} arguments is always true`);
    }

    this.quantify(0, max, propositions);
  }

  /**
   * Require that exactly one of the arguments be true.
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
   * Marks two propositions as inconsistent
   */
  inconsistent(a: Proposition, b: Proposition) {
    this.atMost(1, [a, b]);
  }

  /**
   * Indicates that the premise or premises imply the conclusion:
   * if the premise(s) hold(s), the conclusion must also hold.
   *
   * An array of premises is treated as conjunction: `p.implies([a, b, c], d)`
   * logically means `(a /\ b /\ c) -> d`.
   *
   * Leaves open the possibility that the conclusion must be true even if all
   * premises are false. If you only want `d` to be true if there's some reason
   * for it to be true, you want to use `rule()`, not `implies()`.
   *
   * @param premises A conjuctive list of premises
   * @param conclusion A proposition that must be true if premises are
   */
  implies(premises: Proposition[], conclusion: Proposition) {
    const conc = this.lookup(conclusion);
    const prems = premises.map((prem) => -this.lookup(prem));
    const clause = [...prems, conc];

    this.reset();
    this._constraints.push({
      clause,
      lo: 1,
      hi: clause.length,
    });
  }

  private iff(premises: InternalAtom[], conclusion: InternalAtom) {
    // conclusion implies, in turn, each premise
    this._constraints.push(
      ...premises.map((premise) => ({
        clause: [premise, -conclusion],
        lo: 1,
        hi: 2,
      })),
    );
    // premises imply conclusion
    const clause = [...premises.map((prem) => -prem), conclusion];
    this._constraints.push({
      clause,
      lo: 1,
      hi: clause.length,
    });
  }

  /**
   * Requires two conjuctive formulas to have the same truth value.
   *
   * An array is treated as conjunction: `Equal([a, b], [c, d, e])` logically
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
        this._constraints.push(
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
   * Assert that a single fact must  be true.
   */
  assert(a: Proposition) {
    this.all([a]);
  }

  /**
   * Indicates that the conclusion (the "head" of the rule) is defined
   * by its premise. If the premise(s) hold(s), the conclusion must also hold,
   * and if the conclusion holds, then the truth of that conclusion must be
   * derivable via some rule for which the premise holds.
   *
   * (It's the second part, the fact that the conclusion must be derivable
   * from some premise that holds, which makes Rule different from Implies,
   * aside from them facing the opposite direction.)
   *
   * An array of premises is treated as conjunction: `Rule(a, [b, c, d])`
   * logically means that `(b /\ c /\ d) -> a` and that, if `a` holds,
   * either `(b /\ c /\ d)` OR the premises of some other rule that has
   * `a` as its conclusion must hold.
   *
   * @param conclusion The head of the rule (must not be negated)
   * @param premises A conjuctive list of premises
   */
  rule(conclusion: Atom, premises: Proposition[]) {
    const conc = this.lookup(conclusion);
    const prems = premises.map((p) => this.lookup(p));
    if (conc < 0) {
      throw new Error(`Conclusion '${conclusion}' of a rule must be positive`);
    }
    this.implies(premises, conclusion);

    // Add iff-completion
    if (!this._rules[conc]) {
      this._rules[conc] = [];
    }
    if (premises.length === 0) {
      this._rules[conc].push(0);
    } else if (premises.length === 1) {
      this._rules[conc].push(prems[0]);
    } else {
      const standin = this.generate();
      this.iff(prems, standin);
      this._rules[conc].push(standin);
    }
  }

  private satisfies(assignment: Assignment) {
    const suggestionMap = assignment.map(() => 0);
    let clausesSatisfied = this._constraints.reduce((accum, { lo, hi, clause }) => {
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

    if (clausesSatisfied === this._constraints.length) {
      return null;
    }

    let best: InternalAtom[] = [];
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

  showConstraints() {
    this._constraints.map(({ lo, hi, clause }, i) => {
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

  solve() {
    if (this.nonRuleConstraints === null) {
      this.nonRuleConstraints = this._constraints.length;

      this._constraints.push(
        ...Object.entries(this._rules).map(([head, possibleJustifications]) => {
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
    let windowSize = Math.max(3, Math.ceil(this._constraints.length / 6));
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

      // Should we change the noise? (Hoos 2002)
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

    this.satisfyingAssignment = assignment;
  }

  /**
   * Invariant: if an Atom is given as an argument, it must be valid, in
   * canonical form, and must not already exist. Only the `this.predicate`
   * method calls generate with an argument.
   *
   * With no argument, this creates an internal-only predicate.
   */
  private generate(prop?: Atom): InternalAtom {
    const newLiteral = this.fromInternal.length;
    this.fromInternal.push(prop || '');
    return newLiteral;
  }

  /**
   * Declares a new predicate.
   *
   * To create a new atom that takes no arguments, you can write
   * something like `p.predicate('q')` or `p.predicate('q', [])`. Both mean
   * the same thing: they declare a predicate `q` that takes no
   * arguments.
   *
   * To specify a predicate that does take arguments, you must
   * describe the *domain* of those arguments. For instance, if
   * you wanted to describe some cats and their colors, so that
   * you could say `colored celeste gray` and `colored terra orange`,
   * then you'd declare a predicate `colored` like this:
   *
   * ```
   * let cast = ['celeste', 'nimbus', 'terra'];
   * let color = ['gray', 'black', 'white', 'orange'];
   * p.predicate('colored', [cast, color]);
   * ```
   *
   * @param name The name of the predicate.
   * @param args The domains of the argument.
   */
  predicate(name: string, args: string[][] = []) {
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
          `Cannot declare ${name}/${arity} when ${name}/${existingArity} was previously declared`,
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

  get values() {
    if (this.satisfyingAssignment === null) {
      return null;
    }

    return this.satisfyingAssignment
      .map((v, i) => (v ? this.fromInternal[i] : undefined))
      .filter((x) => x);
  }
}
