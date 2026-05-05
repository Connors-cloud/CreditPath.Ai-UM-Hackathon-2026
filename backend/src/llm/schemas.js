import { z } from 'zod';

export const lecturerVerdictSchema = z.object({
  verdict: z.enum(['approved', 'rejected', 'edge_case_approved', 'edge_case_rejected']),
  final_coverage_percent: z.number().int().min(0).max(100),
  rule_check: z.object({
    meets_80_percent: z.boolean(),
    meets_grade_c: z.boolean()
  }),
  exact_matches: z.array(z.string()),
  additional_matches_found: z.array(z.object({
    uni_topic: z.string(),
    diploma_topic: z.string(),
    diploma_subject_code: z.string(),
    reasoning: z.string()
  })),
  missed_topics: z.array(z.string()),
  reference_overlap: z.enum(['strong', 'partial', 'weak', 'none']),
  reason: z.string(),
  edge_case_notes: z.string().nullable().optional()
});

export const strategistResponseSchema = z.object({
  strategies: z.array(z.object({
    label: z.string(),
    claims: z.array(z.object({
      uni_subject_code: z.string(),
      uni_subject_name: z.string(),
      diploma_subject_codes: z.array(z.string()),
      claim_type: z.enum(['standalone', 'combo']),
      credits_earned: z.number().int(),
      coverage_percent: z.number().int()
    })),
    total_credits_transferred: z.number().int(),
    uni_subjects_transferred_count: z.number().int(),
    diploma_subjects_used_count: z.number().int(),
    explanation: z.string()
  })),
  recommendation: z.string()
});
