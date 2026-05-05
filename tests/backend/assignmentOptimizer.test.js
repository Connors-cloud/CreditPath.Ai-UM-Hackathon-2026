import { describe, it, expect } from 'vitest';
import { optimizeAssignment } from '../../backend/src/optimizer/assignmentOptimizer.js';

describe('optimizeAssignment', () => {
  it('returns empty for empty input', () => {
    const result = optimizeAssignment([]);
    expect(result.totalCredits).toBe(0);
    expect(result.selected).toHaveLength(0);
  });

  it('selects a single standalone claim', () => {
    const claims = [{ uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 }];
    const result = optimizeAssignment(claims);
    expect(result.totalCredits).toBe(3);
    expect(result.selected).toHaveLength(1);
  });

  it('selects multiple non-conflicting claims', () => {
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D2'], credits: 4, coveragePercent: 85 }
    ];
    const result = optimizeAssignment(claims);
    expect(result.totalCredits).toBe(7);
    expect(result.selected).toHaveLength(2);
  });

  it('conflicting standalone claims: two uni subjects want same diploma — picks higher credits', () => {
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D1'], credits: 4, coveragePercent: 85 }
    ];
    const result = optimizeAssignment(claims);
    // Can only pick one since D1 is used in both; picks UNI2 (4 credits > 3)
    expect(result.totalCredits).toBe(4);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].uniSubjectCode).toBe('UNI2');
  });

  it('standalone beats combo for same uni subject (tiebreak)', () => {
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 },
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1', 'D2'], credits: 3, coveragePercent: 95 }
    ];
    const result = optimizeAssignment(claims);
    expect(result.selected).toHaveLength(1);
    // Standalone should be preferred (fewer diploma codes) — D2 stays free for other uses
    expect(result.selected[0].diplomaSubjectCodes).toHaveLength(1);
  });

  it('standalone wins over combo preserving other diploma for another uni subject', () => {
    // UNI1 can be claimed standalone (D1) or as combo (D1+D2)
    // UNI2 needs D2 standalone
    // Optimal: take UNI1 standalone + UNI2 standalone = 7 credits
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 },
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1', 'D2'], credits: 3, coveragePercent: 95 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D2'], credits: 4, coveragePercent: 88 }
    ];
    const result = optimizeAssignment(claims);
    expect(result.totalCredits).toBe(7);
    expect(result.selected).toHaveLength(2);
  });

  it('three-way diploma conflict: picks the two highest-credit non-conflicting claims', () => {
    // D1 appears in all three; only one can be picked
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 2, coveragePercent: 80 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D1'], credits: 5, coveragePercent: 85 },
      { uniSubjectCode: 'UNI3', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 }
    ];
    const result = optimizeAssignment(claims);
    expect(result.totalCredits).toBe(5);
    expect(result.selected[0].uniSubjectCode).toBe('UNI2');
  });

  it('combo: both diploma subjects used — neither can be reused', () => {
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1', 'D2'], credits: 3, coveragePercent: 85 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D2'], credits: 3, coveragePercent: 90 }
    ];
    const result = optimizeAssignment(claims);
    // Can't take both since D2 conflicts; UNI2 standalone wins (same credits, fewer diploma codes)
    expect(result.totalCredits).toBe(3);
  });

  it('maximises total credits across complex scenario', () => {
    const claims = [
      { uniSubjectCode: 'UNI1', diplomaSubjectCodes: ['D1'], credits: 3, coveragePercent: 90 },
      { uniSubjectCode: 'UNI2', diplomaSubjectCodes: ['D2'], credits: 3, coveragePercent: 85 },
      { uniSubjectCode: 'UNI3', diplomaSubjectCodes: ['D3'], credits: 4, coveragePercent: 88 },
      { uniSubjectCode: 'UNI4', diplomaSubjectCodes: ['D1', 'D4'], credits: 3, coveragePercent: 80 }
    ];
    const result = optimizeAssignment(claims);
    // UNI1 takes D1, so UNI4 cannot use D1; optimal picks UNI1+UNI2+UNI3 = 10 credits
    expect(result.totalCredits).toBe(10);
  });
});
