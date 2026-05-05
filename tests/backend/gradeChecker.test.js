import { describe, it, expect } from 'vitest';
import { gradeMeetsMinimum, gradesAllMeetMinimum, gradeRank } from '../../backend/src/matching/gradeChecker.js';

describe('gradeMeetsMinimum', () => {
  const passing = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
  const failing = ['C-', 'D+', 'D', 'F'];

  for (const g of passing) {
    it(`${g} passes`, () => expect(gradeMeetsMinimum(g)).toBe(true));
  }

  for (const g of failing) {
    it(`${g} fails`, () => expect(gradeMeetsMinimum(g)).toBe(false));
  }

  it('throws on unknown grade', () => {
    expect(() => gradeMeetsMinimum('X')).toThrow('Unknown grade: "X"');
  });

  it('C is the boundary — passes', () => {
    expect(gradeMeetsMinimum('C')).toBe(true);
  });

  it('C- is below boundary — fails', () => {
    expect(gradeMeetsMinimum('C-')).toBe(false);
  });
});

describe('gradesAllMeetMinimum', () => {
  it('returns true when all grades pass', () => {
    expect(gradesAllMeetMinimum(['A', 'B+', 'C'])).toBe(true);
  });

  it('returns false when any grade fails', () => {
    expect(gradesAllMeetMinimum(['A', 'D', 'C'])).toBe(false);
  });

  it('returns true for single passing grade', () => {
    expect(gradesAllMeetMinimum(['C'])).toBe(true);
  });

  it('combo edge: C and C passes', () => {
    expect(gradesAllMeetMinimum(['C', 'C'])).toBe(true);
  });

  it('combo edge: A and F fails', () => {
    expect(gradesAllMeetMinimum(['A', 'F'])).toBe(false);
  });
});

describe('gradeRank', () => {
  it('A+ ranks higher than A', () => {
    expect(gradeRank('A+')).toBeGreaterThan(gradeRank('A'));
  });

  it('C ranks higher than C-', () => {
    expect(gradeRank('C')).toBeGreaterThan(gradeRank('C-'));
  });

  it('throws on unknown', () => {
    expect(() => gradeRank('Z')).toThrow();
  });
});
