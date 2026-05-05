/**
 * Given a list of qualified claims, find the subset that maximises total
 * credits transferred under these constraints:
 *   - each diploma subject used at most once (standalone OR in one combo)
 *   - each uni subject claimed at most once
 *
 * Tiebreak: when two selections give equal credits, prefer the one that uses
 * fewer total diploma subjects (preserves more subjects for other claims).
 * Pre-sort ensures standalone appears before combo for each uni subject.
 *
 * Uses branch-and-bound. Adequate for <500 claims.
 *
 * @param {Array<{uniSubjectCode: string, diplomaSubjectCodes: string[], credits: number, coveragePercent: number}>} claims
 * @returns {{ selected: Array, totalCredits: number }}
 */
export function optimizeAssignment(claims) {
  if (!claims.length) return { selected: [], totalCredits: 0 };

  // Group by uni subject, sort each group: standalone first, then higher coverage
  const byUni = new Map();
  for (const c of claims) {
    const list = byUni.get(c.uniSubjectCode) || [];
    list.push(c);
    byUni.set(c.uniSubjectCode, list);
  }

  const prunedClaims = [];
  for (const list of byUni.values()) {
    list.sort((a, b) => {
      if (a.diplomaSubjectCodes.length !== b.diplomaSubjectCodes.length) {
        return a.diplomaSubjectCodes.length - b.diplomaSubjectCodes.length;
      }
      return b.coveragePercent - a.coveragePercent;
    });
    prunedClaims.push(...list);
  }

  // Sort overall by credits desc for aggressive upper-bound pruning
  prunedClaims.sort((a, b) => b.credits - a.credits);

  let best = { selected: [], totalCredits: 0, diplomaCount: 0 };

  function search(i, usedDip, usedUni, current, currentCredits) {
    // Upper-bound: add all remaining feasible credits
    let remaining = currentCredits;
    for (let j = i; j < prunedClaims.length; j++) {
      const c = prunedClaims[j];
      if (!usedUni.has(c.uniSubjectCode) &&
          c.diplomaSubjectCodes.every(d => !usedDip.has(d))) {
        remaining += c.credits;
      }
    }
    // Strict < so equal-credit paths are still explored for tiebreaking
    if (remaining < best.totalCredits) return;

    if (i >= prunedClaims.length) {
      const diplomaCount = current.reduce((s, c) => s + c.diplomaSubjectCodes.length, 0);
      if (currentCredits > best.totalCredits ||
          (currentCredits === best.totalCredits && diplomaCount < best.diplomaCount)) {
        best = { selected: [...current], totalCredits: currentCredits, diplomaCount };
      }
      return;
    }

    const c = prunedClaims[i];

    // Branch: skip this claim
    search(i + 1, usedDip, usedUni, current, currentCredits);

    // Branch: include this claim (if feasible)
    if (!usedUni.has(c.uniSubjectCode) &&
        c.diplomaSubjectCodes.every(d => !usedDip.has(d))) {
      const newDip = new Set(usedDip);
      c.diplomaSubjectCodes.forEach(d => newDip.add(d));
      const newUni = new Set(usedUni);
      newUni.add(c.uniSubjectCode);
      current.push(c);
      search(i + 1, newDip, newUni, current, currentCredits + c.credits);
      current.pop();
    }
  }

  search(0, new Set(), new Set(), [], 0);
  return { selected: best.selected, totalCredits: best.totalCredits };
}
