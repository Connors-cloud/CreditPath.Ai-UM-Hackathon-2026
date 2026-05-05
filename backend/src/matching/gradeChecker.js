const GRADE_RANK = {
  'A+': 12, 'A': 11, 'A-': 10,
  'B+': 9,  'B': 8,  'B-': 7,
  'C+': 6,  'C': 5,  'C-': 4,
  'D+': 3,  'D': 2,  'F': 1
};
const MIN_PASS = GRADE_RANK['C'];

/**
 * Check whether a single grade meets the minimum (C or higher).
 * @param {string} grade
 * @returns {boolean}
 */
export function gradeMeetsMinimum(grade) {
  const rank = GRADE_RANK[grade];
  if (rank === undefined) {
    throw new Error(`Unknown grade: "${grade}"`);
  }
  return rank >= MIN_PASS;
}

/**
 * Check whether all grades in an array meet the minimum.
 * @param {string[]} grades
 * @returns {boolean}
 */
export function gradesAllMeetMinimum(grades) {
  return grades.every(gradeMeetsMinimum);
}

/**
 * Return the numeric rank for a grade (higher = better).
 * @param {string} grade
 * @returns {number}
 */
export function gradeRank(grade) {
  const rank = GRADE_RANK[grade];
  if (rank === undefined) throw new Error(`Unknown grade: "${grade}"`);
  return rank;
}
