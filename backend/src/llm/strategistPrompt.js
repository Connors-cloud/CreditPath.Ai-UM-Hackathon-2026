/**
 * Build prompts for the Phase 4 Strategist LLM call.
 * @param {{ verdicts: object[], studentPriorities: string }} opts
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildStrategistPrompt({ verdicts, studentPriorities }) {
  const systemPrompt = `You are an academic advisor helping a Malaysian polytechnic diploma graduate plan their optimal credit transfer strategy at UKM FTSM.

NON-NEGOTIABLE RULES:
- Each diploma subject can appear in AT MOST ONE claim across all selected claims (either standalone or inside one combo).
- Combos require both diploma grades to be C or higher.
- If a diploma subject qualifies standalone AND in a combo for the same uni subject, prefer the standalone.
- You MUST call the run_optimizer tool to compute the assignment — do not compute it manually.

OUTPUT: Return ONLY a single JSON object matching the schema. No markdown, no preamble.`;

  const userPrompt = `All per-pair lecturer verdicts:
${JSON.stringify(verdicts, null, 2)}

Student's stated priorities:
"${studentPriorities || 'Maximise transferable credits'}"

YOUR TASK:
1. Filter verdicts to those with verdict in ["approved", "edge_case_approved"] — these are "qualified claims".
2. Call run_optimizer(qualified_claims) to get the maximum-credit assignment.
3. Generate strategies:
   - Strategy A "Maximum Credits": the optimizer output as-is.
   - Strategy B "Conservative": exclude all edge_case_approved claims, re-call optimizer.
   - Strategy C (only if student priorities mention a specific goal): custom plan.
4. For each strategy, write a 3-5 sentence explanation covering what it transfers, tradeoffs, when to pick it.

Return this JSON schema exactly:
{
  "strategies": [
    {
      "label": "<string>",
      "claims": [{"uni_subject_code":"","uni_subject_name":"","diploma_subject_codes":[],"claim_type":"standalone"|"combo","credits_earned":<int>,"coverage_percent":<int>}],
      "total_credits_transferred": <int>,
      "uni_subjects_transferred_count": <int>,
      "diploma_subjects_used_count": <int>,
      "explanation": "<string>"
    }
  ],
  "recommendation": "<string>"
}`;

  return { systemPrompt, userPrompt };
}

/** Tool definition for the optimizer (passed to the LLM). */
export const optimizerToolDefinition = {
  type: 'function',
  function: {
    name: 'run_optimizer',
    description: 'Runs the deterministic assignment optimizer to find the maximum-credit subset of qualified claims under the one-time-use constraint.',
    parameters: {
      type: 'object',
      properties: {
        qualified_claims: {
          type: 'array',
          description: 'Array of qualified claims to optimise.',
          items: {
            type: 'object',
            properties: {
              uniSubjectCode: { type: 'string' },
              uniSubjectName: { type: 'string' },
              diplomaSubjectCodes: { type: 'array', items: { type: 'string' } },
              credits: { type: 'integer' },
              coveragePercent: { type: 'integer' }
            },
            required: ['uniSubjectCode', 'diplomaSubjectCodes', 'credits', 'coveragePercent']
          }
        }
      },
      required: ['qualified_claims']
    }
  }
};
