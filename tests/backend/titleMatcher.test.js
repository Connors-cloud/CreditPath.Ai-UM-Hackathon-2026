import { describe, it, expect } from 'vitest';
import { normalizeTitle } from '../../backend/src/matching/titleNormalizer.js';
import { matchTopics, buildTopicPool } from '../../backend/src/matching/titleMatcher.js';

describe('normalizeTitle', () => {
  it('lowercases and trims', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('hello world');
  });

  it('removes punctuation', () => {
    expect(normalizeTitle('Object-Oriented Programming')).toBe('object oriented programming');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeTitle('A   B   C')).toBe('a b c');
  });

  it('returns empty string for non-string input', () => {
    expect(normalizeTitle(null)).toBe('');
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(42)).toBe('');
  });
});

describe('matchTopics', () => {
  it('returns 100% when all topics match', () => {
    const uni = ['Introduction to Programming', 'Variables and Data Types', 'Control Structures'];
    const diploma = ['Introduction to Programming', 'Variables and Data Types', 'Control Structures'];
    const result = matchTopics(uni, diploma);
    expect(result.rawCoveragePercent).toBe(100);
    expect(result.matched).toHaveLength(3);
    expect(result.unmatched).toHaveLength(0);
  });

  it('matches after normalization (case and punctuation)', () => {
    const uni = ['Object-Oriented Programming'];
    const diploma = ['object oriented programming'];
    const result = matchTopics(uni, diploma);
    expect(result.rawCoveragePercent).toBe(100);
  });

  it('returns 0% when nothing matches', () => {
    const uni = ['Artificial Intelligence', 'Neural Networks'];
    const diploma = ['Web Programming', 'Database Management'];
    const result = matchTopics(uni, diploma);
    expect(result.rawCoveragePercent).toBe(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it('handles partial match correctly', () => {
    const uni = ['A', 'B', 'C', 'D'];
    const diploma = ['A', 'B'];
    const result = matchTopics(uni, diploma);
    expect(result.rawCoveragePercent).toBe(50);
    expect(result.matched).toEqual(['A', 'B']);
    expect(result.unmatched).toEqual(['C', 'D']);
  });

  it('returns 0% for empty uni topic list', () => {
    const result = matchTopics([], ['something']);
    expect(result.rawCoveragePercent).toBe(0);
  });

  it('rounds coverage percent', () => {
    const uni = ['A', 'B', 'C'];
    const diploma = ['A'];
    const result = matchTopics(uni, diploma);
    expect(result.rawCoveragePercent).toBe(33);
  });
});

describe('buildTopicPool', () => {
  it('deduplicates topics from multiple subjects', () => {
    const subjects = [
      { topics_json: JSON.stringify(['A', 'B', 'C']) },
      { topics_json: JSON.stringify(['B', 'C', 'D']) }
    ];
    const pool = buildTopicPool(subjects);
    expect(pool).toHaveLength(4);
    expect(pool).toContain('A');
    expect(pool).toContain('D');
  });

  it('deduplicates case-insensitively', () => {
    const subjects = [
      { topics_json: JSON.stringify(['Object-Oriented Programming']) },
      { topics_json: JSON.stringify(['object oriented programming']) }
    ];
    const pool = buildTopicPool(subjects);
    expect(pool).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(buildTopicPool([])).toEqual([]);
  });
});
