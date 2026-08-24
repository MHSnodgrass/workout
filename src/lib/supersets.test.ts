import { describe, expect, it } from 'vitest';
import {
  blockRestSeconds,
  groupBlocks,
  linkToPrevious,
  nextGroupId,
  reorderBlocks,
  roundCompleted,
  totalRounds,
  unlink,
} from './supersets';

/** Minimal stand-ins for RoutineExercise rows, already sorted by order. */
function rows(...groups: (number | undefined)[]) {
  return groups.map((supersetGroup, i) => ({ id: i + 1, order: (i + 1) * 10, supersetGroup }));
}

describe('groupBlocks', () => {
  it('makes every ungrouped exercise its own block', () => {
    expect(groupBlocks(rows(undefined, undefined)).map((b) => b.map((r) => r.id))).toEqual([
      [1],
      [2],
    ]);
  });

  it('merges adjacent members of the same group', () => {
    expect(groupBlocks(rows(undefined, 1, 1, undefined)).map((b) => b.map((r) => r.id))).toEqual([
      [1],
      [2, 3],
      [4],
    ]);
  });

  it('handles three exercises in one group', () => {
    expect(groupBlocks(rows(2, 2, 2)).map((b) => b.map((r) => r.id))).toEqual([[1, 2, 3]]);
  });

  it('splits a group that is no longer contiguous', () => {
    // A superset is performed back-to-back by definition, so a group whose
    // members drifted apart is two blocks, not one card with a hole in it.
    expect(groupBlocks(rows(1, undefined, 1)).map((b) => b.map((r) => r.id))).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it('keeps different adjacent groups apart', () => {
    expect(groupBlocks(rows(1, 1, 2, 2)).map((b) => b.map((r) => r.id))).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe('nextGroupId', () => {
  it('starts at 1 and climbs past the highest in use', () => {
    expect(nextGroupId(rows(undefined, undefined))).toBe(1);
    expect(nextGroupId(rows(1, 1, 4))).toBe(5);
  });
});

describe('linkToPrevious', () => {
  it('opens a new group covering both exercises', () => {
    expect(linkToPrevious(rows(undefined, undefined), 2)).toEqual([
      { id: 1, supersetGroup: 1 },
      { id: 2, supersetGroup: 1 },
    ]);
  });

  it('joins the group the exercise above already belongs to', () => {
    expect(linkToPrevious(rows(3, 3, undefined), 3)).toEqual([{ id: 3, supersetGroup: 3 }]);
  });

  it('does nothing for the first exercise — there is nothing above it', () => {
    expect(linkToPrevious(rows(undefined, undefined), 1)).toEqual([]);
  });

  it('does nothing when the two are already grouped together', () => {
    expect(linkToPrevious(rows(1, 1), 2)).toEqual([]);
  });
});

describe('unlink', () => {
  it('dissolves a pair entirely — a superset of one is not a superset', () => {
    expect(unlink(rows(1, 1), 2)).toEqual([
      { id: 2, supersetGroup: undefined },
      { id: 1, supersetGroup: undefined },
    ]);
  });

  it('leaves the rest of a trio grouped', () => {
    expect(unlink(rows(1, 1, 1), 3)).toEqual([{ id: 3, supersetGroup: undefined }]);
  });

  it('does nothing to an exercise that is not grouped', () => {
    expect(unlink(rows(undefined, undefined), 1)).toEqual([]);
  });
});

describe('reorderBlocks', () => {
  it('swaps two plain exercises, as before', () => {
    expect(reorderBlocks(rows(undefined, undefined), 2, -1)).toEqual([
      { id: 2, order: 10 },
      { id: 1, order: 20 },
    ]);
  });

  it('moves a whole pair past the exercise above it', () => {
    // Rows: [1] [2,3 paired]. Moving the pair up must not strand exercise 2
    // above exercise 1 and leave 3 behind.
    expect(reorderBlocks(rows(undefined, 1, 1), 2, -1)).toEqual([
      { id: 2, order: 10 },
      { id: 3, order: 20 },
      { id: 1, order: 30 },
    ]);
  });

  it('moves a whole pair past the exercise below it', () => {
    expect(reorderBlocks(rows(1, 1, undefined), 1, 1)).toEqual([
      { id: 3, order: 10 },
      { id: 1, order: 20 },
      { id: 2, order: 30 },
    ]);
  });

  it('swaps two pairs', () => {
    expect(reorderBlocks(rows(1, 1, 2, 2), 3, -1)).toEqual([
      { id: 3, order: 10 },
      { id: 4, order: 20 },
      { id: 1, order: 30 },
      { id: 2, order: 40 },
    ]);
  });

  it('does nothing at the ends', () => {
    expect(reorderBlocks(rows(1, 1, undefined), 2, -1)).toEqual([]);
    expect(reorderBlocks(rows(undefined, 1, 1), 3, 1)).toEqual([]);
  });
});

describe('totalRounds', () => {
  it('runs to the longer exercise', () => {
    expect(totalRounds([{ targetSets: 3, loggedSets: 0 }, { targetSets: 4, loggedSets: 0 }])).toBe(
      4,
    );
  });

  it('extends past target when extra sets were logged', () => {
    expect(totalRounds([{ targetSets: 3, loggedSets: 5 }, { targetSets: 3, loggedSets: 3 }])).toBe(
      5,
    );
  });
});

describe('roundCompleted', () => {
  const pair = () => [
    { targetSets: 3, loggedSets: 0 },
    { targetSets: 3, loggedSets: 0 },
  ];

  it('is false for the first exercise of the round — the pair is not done', () => {
    expect(roundCompleted(pair(), 0)).toBe(false);
  });

  it('is true once the second exercise lands', () => {
    const members = pair();
    members[0].loggedSets = 1;
    expect(roundCompleted(members, 1)).toBe(true);
  });

  it('is true when the other exercise has run out of sets', () => {
    // 3×bench paired with 4×row: round 4 is rows alone, and finishing it
    // still earns a rest.
    const members = [
      { targetSets: 3, loggedSets: 3 },
      { targetSets: 4, loggedSets: 3 },
    ];
    expect(roundCompleted(members, 1)).toBe(true);
  });

  it('is true for a lone exercise every time — that is the old behaviour', () => {
    expect(roundCompleted([{ targetSets: 3, loggedSets: 0 }], 0)).toBe(true);
    expect(roundCompleted([{ targetSets: 3, loggedSets: 2 }], 0)).toBe(true);
  });

  it('stays false while the partner is a full set behind', () => {
    const members = [
      { targetSets: 3, loggedSets: 1 },
      { targetSets: 3, loggedSets: 0 },
    ];
    expect(roundCompleted(members, 0)).toBe(false);
  });
});

describe('blockRestSeconds', () => {
  it('takes the longest rest in the pair', () => {
    // You rest after the harder half, so the shorter rest would cut it short.
    expect(blockRestSeconds([90, 180])).toBe(180);
  });

  it('is just the exercise’s own rest when it stands alone', () => {
    expect(blockRestSeconds([120])).toBe(120);
  });
});
