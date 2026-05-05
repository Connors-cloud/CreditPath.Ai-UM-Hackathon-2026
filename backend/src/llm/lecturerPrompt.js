/**
 * Build the system + user prompts for the Phase 3 Lecturer LLM call.
 * @param {{ uni: object, diploma: object[], phase1: object }} opts
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildLecturerPrompt({ uni, diploma, phase1 }) {
  const uniTopics = typeof uni.topics_json === 'string' ? JSON.parse(uni.topics_json) : uni.topics_json;
  const uniRefs = typeof uni.references_json === 'string' ? JSON.parse(uni.references_json) : uni.references_json;

  const systemPrompt = `You are a senior university lecturer at UKM Fakulti Teknologi dan Sains Maklumat (FTSM), evaluating a credit transfer request from a Malaysian polytechnic diploma student.

RULES YOU MUST APPLY:
1. Approve transfer only if ≥80% of university topic titles are covered AND diploma grade is C or higher.
2. For a combo (two diploma subjects), the 80% is computed over the union of their topic pools, both grades must be C or higher.
3. Recognise concept matches where titles differ but clearly refer to the same material (e.g., "OOP" → "Object Oriented Programming"). Only add matches you are confident about.
4. Use textbook reference overlap as corroborating evidence. Same textbooks strengthen equivalence; unrelated references should make you more cautious.
5. Your decision must be consistent — the same inputs yield the same output.

OUTPUT: Return ONLY a single JSON object. No markdown, no preamble.`;

  const diplomaBlocks = diploma.map((d, idx) => {
    const topics = typeof d.topics_json === 'string' ? JSON.parse(d.topics_json) : d.topics_json;
    const refs = typeof d.references_json === 'string' ? JSON.parse(d.references_json) : d.references_json;
    return `Subject ${idx + 1}:
Code: ${d.code}
Name: ${d.name}
Institution: ${d.institution}
Grade Achieved: ${d.grade}
Credits: ${d.credit}
Topics Covered:
${topics.map(t => `  - ${t}`).join('\n')}
References:
${refs.map(r => `  - ${r}`).join('\n')}`;
  }).join('\n\n');

  const userPrompt = `=== UNIVERSITY SUBJECT ===
Code: ${uni.code}
Name: ${uni.name}
Credits: ${uni.credit}
Topics Required (${uniTopics.length}):
${uniTopics.map(t => `- ${t}`).join('\n')}
References:
${uniRefs.map(r => `- ${r}`).join('\n')}

=== DIPLOMA SUBJECT(S) ===
${diplomaBlocks}

=== DETERMINISTIC PRE-ANALYSIS (do not recompute) ===
Exact Matched Uni Topics: ${JSON.stringify(phase1.matched)}
Unmatched Uni Topics: ${JSON.stringify(phase1.unmatched)}
Raw Coverage: ${phase1.rawCoveragePercent}%
Grade Rule Passed: ${phase1.gradePassed}

YOUR TASK:
1. Review unmatched uni topics — identify any conceptual matches from diploma topics.
2. Recompute final coverage: (exact_matches + additional_matches) / total_uni_topics.
3. Note reference overlap.
4. Verdict: "approved" if final_coverage≥80% AND grade≥C; "edge_case_approved" if 78-82% with strong refs and grade B+; "edge_case_rejected" if 78-82% with weak refs or grade C; "rejected" otherwise.
5. Write a 2-4 sentence reason in a lecturer's voice, naming missed topics specifically.

Return this JSON schema exactly:
{
  "verdict": "approved"|"rejected"|"edge_case_approved"|"edge_case_rejected",
  "final_coverage_percent": <integer>,
  "rule_check": { "meets_80_percent": <bool>, "meets_grade_c": <bool> },
  "exact_matches": [<strings>],
  "additional_matches_found": [{"uni_topic":"","diploma_topic":"","diploma_subject_code":"","reasoning":""}],
  "missed_topics": [<strings>],
  "reference_overlap": "strong"|"partial"|"weak"|"none",
  "reason": "<string>",
  "edge_case_notes": null|"<string>"
}`;

  return { systemPrompt, userPrompt };
}
