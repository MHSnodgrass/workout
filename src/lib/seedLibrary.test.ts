import { describe, expect, it } from 'vitest';
import {
  SEED_RESULT_LIMIT,
  mapSeedMuscles,
  searchSeed,
  seedType,
  type SeedExercise,
} from './seedLibrary';

function entry(over: Partial<SeedExercise> = {}): SeedExercise {
  return {
    name: 'Bench Press',
    equipment: 'barbell',
    force: 'push',
    category: 'strength',
    primaryMuscles: ['chest'],
    ...over,
  };
}

describe('mapSeedMuscles', () => {
  it('maps the dataset vocabulary onto our ten groups', () => {
    expect(mapSeedMuscles(['chest'])).toEqual(['Chest']);
    expect(mapSeedMuscles(['quadriceps'])).toEqual(['Quads']);
    expect(mapSeedMuscles(['abdominals'])).toEqual(['Core']);
  });

  it('collapses the four back names onto Back, once', () => {
    expect(mapSeedMuscles(['lats', 'middle back', 'lower back', 'traps'])).toEqual(['Back']);
  });

  it('files both adductors and abductors under Glutes', () => {
    expect(mapSeedMuscles(['abductors'])).toEqual(['Glutes']);
    expect(mapSeedMuscles(['adductors'])).toEqual(['Glutes']);
  });

  it('drops names our vocabulary has no group for', () => {
    // Forearms and neck have no home in MUSCLE_GROUPS. An imported grip curl
    // lands untagged, exactly like one you typed in yourself.
    expect(mapSeedMuscles(['forearms'])).toEqual([]);
    expect(mapSeedMuscles(['neck'])).toEqual([]);
    expect(mapSeedMuscles(['forearms', 'biceps'])).toEqual(['Biceps']);
  });

  it('returns groups in canonical order, not input order', () => {
    expect(mapSeedMuscles(['triceps', 'chest'])).toEqual(['Chest', 'Triceps']);
  });

  it('ignores names that are not in the dataset vocabulary at all', () => {
    expect(mapSeedMuscles(['spleen'])).toEqual([]);
  });
});

describe('seedType', () => {
  it('calls a static hold timed, whatever the equipment', () => {
    expect(seedType(entry({ name: 'Plank', force: 'static', equipment: 'body only' }))).toBe(
      'timed',
    );
    expect(seedType(entry({ force: 'static', equipment: 'exercise ball' }))).toBe('timed');
  });

  it('calls unloaded movement bodyweight', () => {
    expect(seedType(entry({ force: 'pull', equipment: 'body only' }))).toBe('bodyweight');
  });

  it('treats missing equipment as unloaded', () => {
    expect(seedType(entry({ force: 'pull', equipment: '' }))).toBe('bodyweight');
  });

  it('calls everything else weighted', () => {
    expect(seedType(entry({ equipment: 'barbell' }))).toBe('weighted');
    expect(seedType(entry({ equipment: 'machine', force: '' }))).toBe('weighted');
  });
});

describe('searchSeed', () => {
  const library = [
    entry({ name: 'Barbell Bench Press' }),
    entry({ name: 'Incline Dumbbell Press', equipment: 'dumbbell' }),
    entry({ name: 'Barbell Squat', primaryMuscles: ['quadriceps'], equipment: 'barbell' }),
    entry({
      name: 'Chest Stretch on Stability Ball',
      category: 'stretching',
      force: 'static',
      equipment: 'exercise ball',
    }),
  ];

  it('matches on name, case-insensitively', () => {
    expect(searchSeed(library, 'squat').results.map((e) => e.name)).toEqual(['Barbell Squat']);
  });

  it('matches on muscle group, so "chest" finds presses', () => {
    const names = searchSeed(library, 'chest').results.map((e) => e.name);
    expect(names).toContain('Barbell Bench Press');
    expect(names).toContain('Incline Dumbbell Press');
  });

  it('matches on equipment', () => {
    expect(searchSeed(library, 'dumbbell').results.map((e) => e.name)).toEqual([
      'Incline Dumbbell Press',
    ]);
  });

  it('sorts stretches below real work', () => {
    // The point of the whole rule: searching "chest" must not lead with a
    // stability-ball stretch.
    const names = searchSeed(library, 'chest').results.map((e) => e.name);
    expect(names[names.length - 1]).toBe('Chest Stretch on Stability Ball');
  });

  it('leads with names that start with the query', () => {
    const names = searchSeed(library, 'barbell').results.map((e) => e.name);
    expect(names[0]).toBe('Barbell Bench Press');
  });

  it('ranks loadable work above drills, even when the drill matches the name better', () => {
    // Searching "chest" must not lead with a medicine-ball plyo drill called
    // "Chest Push" while every bench press sits below it.
    const withDrill = [
      ...library,
      entry({ name: 'Chest Push', category: 'plyometrics', equipment: 'medicine ball' }),
    ];
    const names = searchSeed(withDrill, 'chest').results.map((e) => e.name);
    expect(names.indexOf('Barbell Bench Press')).toBeLessThan(names.indexOf('Chest Push'));
    expect(names.indexOf('Chest Push')).toBeLessThan(
      names.indexOf('Chest Stretch on Stability Ball'),
    );
  });

  it('returns everything for an empty query', () => {
    expect(searchSeed(library, '   ').results).toHaveLength(library.length);
  });

  it('reports the true total alongside the capped results', () => {
    const many = Array.from({ length: SEED_RESULT_LIMIT + 5 }, (_, i) =>
      entry({ name: `Curl ${i}` }),
    );
    const found = searchSeed(many, 'curl');
    expect(found.results).toHaveLength(SEED_RESULT_LIMIT);
    expect(found.total).toBe(SEED_RESULT_LIMIT + 5);
  });

  it('excludes names already in the library', () => {
    const found = searchSeed(library, 'barbell', { exclude: new Set(['barbell squat']) });
    expect(found.results.map((e) => e.name)).toEqual(['Barbell Bench Press']);
    expect(found.total).toBe(1);
  });
});
