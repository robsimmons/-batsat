import { Proposition, Problem } from '.';

function exactTest(p: Problem, models: Proposition[][], minTests?: number, maxTests?: number) {
  let MIN = minTests || 100;
  let MAX = maxTests || 100000;

  models.map((model) => model.sort());
  const successes = models.map(() => false);

  let iterCount = 0;
  while (true) {
    p.solve();
    const model = p.values!.sort();
    let found = false;
    for (let j = 0; j < models.length; j++) {
      const expected = models[j];
      if (model.length === expected.length && model.every((prop, k) => prop === expected[k])) {
        found = true;
        successes[j] = true;
        break;
      }
    }
    if (!found) {
      expect({ unexpectedModelsDiscovered: null }).toBe({
        unexpectedModelDiscovered: `{ ${model.join(', ')} }`,
      });
    }
    const done = successes.every((x) => x);

    iterCount += 1;

    if (done && iterCount >= MIN) {
      expect(true).toBe(true);
      return;
    }

    if (iterCount >= MAX) {
      let modelsNotDiscovered = models
        .filter((_, i) => !successes[i])
        .map((propositions) => `{ ${propositions.join(', ')} }`);
      expect({ modelsNotDiscovered: [] }).toBe({ modelsNotDiscovered });
    }
  }
}

test('p <= -q, q <= -p, does not admit {p, q} as a solution', () => {
  const p = new Problem();
  p.predicate('p');
  p.predicate('q');

  p.rule('q', ['!p']);
  p.rule('p', ['!q']);
  exactTest(p, [['p'], ['q']]);
});

test('-q > p, -p > q, admits {p, q} as a solution', () => {
  const p = new Problem();
  p.predicate('p', []);
  p.predicate('q', []);

  p.implies([`!p`], `q`);
  p.implies([`!q`], `p`);
  exactTest(p, [['p'], ['q'], ['p', 'q']]);
});

test('Iff-completion for a proposition defined by two rules', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');
  p.predicate('d');

  p.rule(`a`, [`b`, `c`]);
  p.rule(`a`, [`d`]);

  exactTest(p, [
    [],
    ['b'],
    ['c'],
    ['a', 'd'],
    ['a', 'b', 'c'],
    ['a', 'b', 'd'],
    ['a', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
  ]);
});

test('quantification()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');
  p.predicate('d');

  expect(() => {
    p.quantify(-2, -1, ['a', 'b', 'd']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(5, 6, ['a', 'b', 'd']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(2, 1, ['a', 'b', 'd']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(2, 2, ['a', 'b', 'c']);
  }).not.toThrow();

  exactTest(p, [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
    ['a', 'b', 'd'],
    ['a', 'c', 'd'],
    ['b', 'c', 'd'],
  ]);
});

test('equals()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');

  p.equal([`a`], [`b`]);
  exactTest(p, [[], ['a', 'b']]);

  p.predicate('c');
  p.predicate('d');
  p.equal([`a`, `c`], [`d`]);
  exactTest(p, [[], ['c'], ['a', 'b'], ['a', 'b', 'c', 'd']]);

  p.equal([`c`], [`a`, `d`]);
  exactTest(p, [[], ['a', 'b'], ['a', 'b', 'c', 'd']]);

  p.predicate('e');
  p.predicate('f');
  p.equal([`c`, `d`], [`!e`, `!f`]);
  exactTest(p, [
    ['e'],
    ['f'],
    ['e', 'f'],
    ['a', 'b', 'e'],
    ['a', 'b', 'f'],
    ['a', 'b', 'e', 'f'],
    ['a', 'b', 'c', 'd'],
  ]);

  p.equal(['!e'], ['!f']);
  exactTest(p, [
    ['e', 'f'],
    ['a', 'b', 'e', 'f'],
    ['a', 'b', 'c', 'd'],
  ]);

  expect(() => {
    p.equal([], []);
  }).toThrowErrorMatchingSnapshot();
});

test('exactly()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  expect(() => {
    p.exactly(1.5, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.exactly(-1, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.exactly(4, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.exactly(0, []);
  }).toThrowErrorMatchingSnapshot();

  p.exactly(2, ['a', 'b', 'c']);

  exactTest(p, [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
  ]);

  p.exactly(1, ['!a', '!c']);

  exactTest(p, [
    ['a', 'b'],
    ['b', 'c'],
  ]);

  p.exactly(1, ['b']);
  p.exactly(0, ['c']);

  exactTest(p, [['a', 'b']]);
});

test('atMost()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  expect(() => {
    p.atMost(-1, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.atMost(5, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  p.atMost(2.2, ['a', 'b', '!c']);

  exactTest(p, [[], ['a'], ['b'], ['c'], ['a', 'c'], ['b', 'c'], ['a', 'b', 'c']]);

  p.atMost(0, ['a', '!b']);
  exactTest(p, [['b'], ['b', 'c']]);
});

test('atLeast()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  expect(() => {
    p.atLeast(0, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.atLeast(4, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  p.atLeast(2, ['a', '!b']);

  exactTest(p, [['a'], ['a', 'c']]);
});

test('all()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  expect(() => {
    p.all([]);
  }).toThrowErrorMatchingSnapshot();

  p.all(['!a', '!b', '!c']);

  exactTest(p, [[]]);
});
test('unique()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  expect(() => {
    p.unique([]);
  }).toThrowErrorMatchingSnapshot();

  p.unique([`a`]);
  p.unique([`b`, `c`]);

  exactTest(p, [
    ['a', 'b'],
    ['a', 'c'],
  ]);
});

test('inconsistent()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  p.inconsistent(`a`, `!b`);
  p.inconsistent(`b`, `c`);

  exactTest(p, [[], ['b'], ['c'], ['a', 'b']]);
});

test('quantify()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');
  p.predicate('d');
  p.predicate('e');

  expect(() => {
    p.quantify(-1, -1, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(1.3, 1.4, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(5, 5, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  expect(() => {
    p.quantify(0, 3, ['a', 'b', 'c']);
  }).toThrowErrorMatchingSnapshot();

  p.quantify(2, 2, ['a', 'b', 'c']);
  p.quantify(1.5, 3.5, ['a', 'b', 'c', 'd', 'e']);

  exactTest(p, [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
    ['a', 'b', 'd'],
    ['a', 'b', 'e'],
    ['a', 'c', 'd'],
    ['a', 'c', 'e'],
    ['b', 'c', 'd'],
    ['b', 'c', 'e'],
  ]);
});

test('values()', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');

  p.assert(`a`);
  p.assert(`!b`);

  expect(p.values).toBeNull();
  p.solve();
  expect(p.values).toEqual(['a']);
});

test('test all supported arities', () => {
  const p = new Problem();
  const two = ['green', 'red'];
  const three = ['apple', 'banana', 'kiwi'];
  p.predicate('a');
  p.predicate('b', [two]);
  p.predicate('c', [two, three]);
  p.predicate('d', [two, two, two]);

  for (const x of two) {
    for (const y of three) {
      p.rule(`c ${x} ${y}`, [`b ${x}`]);
    }

    // d X X X :- b X
    for (const y of two) {
      for (const z of two) {
        if (x === y && y === z) {
          p.rule(`d ${x} ${y} ${z}`, [`b ${x}`]);
        } else {
          p.assert(`!d ${x} ${y} ${z}`);
        }
      }
    }
  }

  p.atMost(1, ['b green', 'b red']);

  exactTest(p, [
    [],
    ['a'],
    ['b green', 'c green apple', 'c green banana', 'c green kiwi', 'd green green green'],
    ['b red', 'c red apple', 'c red banana', 'c red kiwi', 'd red red red'],
    ['a', 'b green', 'c green apple', 'c green banana', 'c green kiwi', 'd green green green'],
    ['a', 'b red', 'c red apple', 'c red banana', 'c red kiwi', 'd red red red'],
  ]);
});

test('Show constraints', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');

  p.quantify(0, 0, [`a`]);
  p.quantify(0, 1, [`a`, `b`]);
  p.quantify(1, 2, [`b`, `c`]);
  p.quantify(1, 2, [`a`, `b`, `c`]);
  p.rule(`b`, []);
  p.rule(`b`, [`a`, `c`]);
  exactTest(p, [['b'], ['b', 'c']]);
  expect(() => {
    p.showConstraints();
  }).not.toThrow();
});

test('Unsatisfiable constraints raise an exception', () => {
  const p = new Problem();
  p.predicate('a');
  p.assert(`a`);
  p.assert(`!a`);
  expect(() => {
    p.solve();
  }).toThrowErrorMatchingSnapshot();
});

test('Negations allowed in implication heads, but not rule heads', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');
  p.predicate('d');

  expect(() => {
    p.implies([`a`], `!b`);
  }).not.toThrow();

  expect(() => {
    p.rule('!c', ['d']);
  }).toThrowErrorMatchingSnapshot();
});

test('Rules with no premises and equals [] work like an assertion', () => {
  const p = new Problem();
  p.predicate('a');
  p.predicate('b');
  p.predicate('c');
  p.predicate('d');
  p.predicate('e');
  p.predicate('f');
  p.predicate('g');

  p.rule(`a`, []);
  p.rule(`b`, [`c`]);
  p.rule(`c`, [`a`]);
  p.assert(`!d`);
  p.equal([], [`f`]);
  p.equal([`!g`, `e`], []);

  exactTest(p, [['a', 'b', 'c', 'e', 'f']]);
});

test('Unsupported arities', () => {
  const p = new Problem();
  const two = ['green', 'red'];
  expect(() => {
    p.predicate('a', [two, two, two, two]);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('b', [two]);
  }).not.toThrow();
  expect(() => {
    p.predicate('b');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('b', [['x', 'y', 'z']]);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('b', [two]);
  }).toThrowErrorMatchingSnapshot();
});

test('Test predicate and constant syntax', () => {
  const p = new Problem();
  expect(() => {
    p.predicate('A');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate(' a ');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('a', [['x'], ['y']]);
  }).not.toThrow();
  expect(() => {
    p.predicate('b', [['x']]);
  }).not.toThrow();
  expect(() => {
    p.predicate('b c');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('1b');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('a1B_C');
  }).not.toThrow();
  expect(() => {
    p.predicate('a', [['X']]);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.predicate('a', [['1X', 'a']]);
  }).toThrow();
  expect(() => {
    p.predicate('a', [['c', 'd e']]);
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('a z');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('a z y');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('a x y z');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('b x y z');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('a Z y');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('_a');
  }).toThrowErrorMatchingSnapshot();
  expect(() => {
    p.assert('f');
  }).toThrowErrorMatchingSnapshot();
});

/*


test('Blah', () => {
  const p = new Problem();
  const cast = ['celeste', 'nimbus', 'dog'];
  const religion = ['feline', 'canine', 'atheist'];
  const domain = ['uplands', 'lowlands', 'doghouse'];
  const occupation = ['merchant', 'scratcher', 'biter'];

  p.Predicate`religion ${cast} ${religion}`;
  p.Predicate`domain ${cast} ${domain}`;
  p.Predicate`occupation ${cast} ${occupation}`;

  for (const c of cast) {
    p.Unique(...religion.map((r) => `religion ${c} ${r}`));
    p.Unique(...domain.map((d) => `domain ${c} ${d}`));
    p.Unique(...occupation.map((o) => `occupation ${c} ${o}`));
    p.Inconsistent(`religion ${c} feline`, `domain ${c} doghouse`);
    p.Inconsistent(`religion ${c} atheist`, `domain ${c} uplands`);
  }

  p.Solve();
  console.log(p.Values);
});


*/

/*
function test1() {
  const p = new Problem();
  p.Predicate`p`;
  p.Predicate`q`;

  p.Implies(['!p'], 'q');
  p.Implies(['!q'], 'p');
  p.Solve();
  console.log(p.Values);
}

test1();

function test2() {
  const p = new Problem();
  p.Predicate`bird`;
  p.Predicate`fish`;
  p.Predicate`mammal`;
  p.Predicate`bite`;
  p.Predicate`claw`;
  p.Predicate`fireBreathing`;

  p.Unique('bird', 'fish', 'mammal');
  p.Unique('bite', 'claw', 'fireBreathing');
  p.Inconsistent('fish', 'claw');
  p.Inconsistent('fish', 'fireBreathing');
  p.Solve();
  console.log(p.Values);
}

test2();
*/
/*
function test3() {
  const p = new Problem();
  const cast = ['red', 'green', 'blue'];
  p.Predicate`rich ${cast}`;
  p.Predicate`caged ${cast}`;
  p.Predicate`hasSword ${cast}`;
  p.Predicate`evil ${cast}`;
  p.Predicate`stabbed ${cast} ${cast}`;
  p.Predicate`loves ${cast} ${cast}`;
  p.Predicate`tombstone ${cast}`;
  p.Predicate`someoneFree`;
  p.Predicate`dead ${cast}`;

  // Panel 1
  p.Assert(`someoneFree`);
  for (const x of cast) {
    // Poverty causes evil in the world
    p.Equal(`evil ${x}`, `!rich ${x}`);
    // Only rich people get taken prisoner
    p.Implies(`caged ${x}`, `rich ${x}`);
    // You have a sword iff you're rich and uncaged
    p.Equal(`hasSword ${x}`, [`rich ${x}`, `!caged ${x}`]);
    // If someone's no caged, someone's free
    p.Rule(`someoneFree`, [`!caged ${x}`]);
    // No suicide
    p.Assert(`!stabbed ${x} ${x}`);
    // You can't kill multiple people
    p.AtMost(1, ...cast.map((y) => `stabbed ${x} ${y}`));
    for (const y of cast) {
      // You need a sword to stab
      p.Implies(`stabbed ${x} ${y}`, `hasSword ${x}`);
      // Only stab evil people
      p.Implies(`stabbed ${x} ${y}`, `evil ${y}`);
    }
  }

  // Panel 2
  for (const x of cast) {
    for (const y of cast) {
      // Dead iff you're stabbed, or caged and not rescued
      p.Rule(`tombstone ${x}`, [`caged ${x}`, `evil ${y}`, `!dead ${y}`]);
      p.Rule(`tombstone ${x}`, [`!someoneFree`]);
      p.Rule(`tombstone ${x}`, [`stabbed ${x} ${y}`]);
      for (const z of cast) {
        // You love someone if they rescue you
        p.Rule(`loves ${x} ${y}`, [`caged ${x}`, `stabbed ${y} ${z}`]);
      }
    }
  }

  p.Solve();
  console.log(p.Values);
}

*/
/*
(window as any).test1 = test1;
(window as any).test2 = test2;
(window as any).test3 = test3;
(window as any).test4 = test4;
*/
/*
function expectTest(
  p: Problem,
  eventually: Proposition[],
  never: Proposition[],
  minTests?: number,
  maxTests?: number,
) {}
*/
