/**
 * Supersets: pairing exercises so their sets alternate, with one rest after the
 * pair rather than one after every set.
 *
 * Two ideas carry the whole feature.
 *
 * **A group is adjacency plus a shared id.** A superset is performed
 * back-to-back by definition, so members must sit next to each other in the
 * routine. That makes `groupBlocks` the single place the grouping is decided —
 * every screen renders blocks, and a routine with no supersets is just a list
 * of one-member blocks.
 *
 * **The unit of work is a round, not a set.** Round 1 is A's first set then
 * B's first. Rest belongs to the round. Rounds run to the *longer* exercise, so
 * pairing 3×bench with 4×rows needs no reconciliation: bench simply stops
 * appearing after round 3 and you finish round 4 alone.
 *
 * Progression is deliberately absent from this file. A superset changes the
 * order sets are performed in, not what either lift should be loaded to.
 */

interface Grouped {
  id?: number;
  supersetGroup?: number;
}

interface Ordered extends Grouped {
  order: number;
}

export function groupBlocks<T extends Grouped>(items: T[]): T[][] {
  const blocks: T[][] = [];
  for (const item of items) {
    const previous = blocks[blocks.length - 1];
    const joins =
      previous !== undefined &&
      item.supersetGroup !== undefined &&
      previous[0].supersetGroup === item.supersetGroup;
    if (joins) previous.push(item);
    else blocks.push([item]);
  }
  return blocks;
}

export function nextGroupId(items: Grouped[]): number {
  const used = items.map((i) => i.supersetGroup).filter((g): g is number => g !== undefined);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/** The changes that link an exercise to the one above it. Empty if it can't. */
export function linkToPrevious(
  items: Grouped[],
  id: number,
): { id: number; supersetGroup: number }[] {
  const index = items.findIndex((i) => i.id === id);
  if (index <= 0) return [];
  const current = items[index];
  const previous = items[index - 1];
  if (previous.supersetGroup !== undefined) {
    if (previous.supersetGroup === current.supersetGroup) return [];
    return [{ id: id, supersetGroup: previous.supersetGroup }];
  }
  const group = nextGroupId(items);
  return [
    { id: previous.id!, supersetGroup: group },
    { id, supersetGroup: group },
  ];
}

/** The changes that pull an exercise out of its group. Empty if it isn't in one. */
export function unlink(
  items: Grouped[],
  id: number,
): { id: number; supersetGroup: undefined }[] {
  const current = items.find((i) => i.id === id);
  if (!current || current.supersetGroup === undefined) return [];
  const changes = [{ id, supersetGroup: undefined }];
  const remaining = items.filter(
    (i) => i.id !== id && i.supersetGroup === current.supersetGroup,
  );
  // A superset of one is not a superset — dissolve the group rather than
  // leaving a lone member wearing a link it can't act on.
  if (remaining.length === 1) changes.push({ id: remaining[0].id!, supersetGroup: undefined });
  return changes;
}

/**
 * Reordering moves whole blocks. Moving a single member would strand it away
 * from its partner and silently dissolve the pair.
 */
export function reorderBlocks<T extends Ordered>(
  items: T[],
  id: number,
  direction: -1 | 1,
): { id: number; order: number }[] {
  const blocks = groupBlocks(items);
  const index = blocks.findIndex((b) => b.some((i) => i.id === id));
  const neighbor = blocks[index + direction];
  if (index === -1 || !neighbor) return [];
  const block = blocks[index];
  const [first, second] = direction === -1 ? [block, neighbor] : [neighbor, block];
  const slots = [...first, ...second].map((i) => i.order).sort((a, b) => a - b);
  return [...first, ...second].map((item, i) => ({ id: item.id!, order: slots[i] }));
}

export interface MemberProgress {
  targetSets: number;
  loggedSets: number;
}

export function totalRounds(members: MemberProgress[]): number {
  return Math.max(...members.map((m) => Math.max(m.targetSets, m.loggedSets)));
}

/**
 * Did logging a set for `memberIndex` just finish the round it belonged to?
 * This is what decides whether rest starts. For a lone exercise it is always
 * true, which is exactly the behaviour the app had before supersets existed.
 */
export function roundCompleted(members: MemberProgress[], memberIndex: number): boolean {
  const round = members[memberIndex].loggedSets;
  return members.every((m, i) => {
    if (round >= m.targetSets) return true; // out of sets; not in this round
    return (i === memberIndex ? m.loggedSets + 1 : m.loggedSets) > round;
  });
}

/** The longest rest in the block: you rest after the harder half of the pair. */
export function blockRestSeconds(restSeconds: number[]): number {
  return Math.max(...restSeconds);
}
