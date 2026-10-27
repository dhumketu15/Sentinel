import { z } from "zod";

const textArray = z.array(z.string().trim().min(1).max(240)).max(40).optional();

export const brandIdParamSchema = z.object({ brandId: z.string().uuid() });
export const auditIdParamSchema = z.object({ auditId: z.string().uuid() });
export const guidelineIdParamSchema = z.object({ guidelineId: z.string().uuid() });

export const createBrandSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  industry: z.string().trim().max(120).optional(),
  website: z.string().url().max(300).optional().or(z.literal("")),
  mission: z.string().trim().max(1000).optional(),
  values: textArray,
  personality: z.string().trim().max(400).optional(),
  targetAudience: z.string().trim().max(600).optional(),
  preferredTone: z.string().trim().max(300).optional(),
  prohibitedPhrases: textArray,
  approvedTerminology: textArray,
  requiredDisclaimers: z.string().trim().max(1000).optional(),
  industryCompliance: z.string().trim().max(1000).optional(),
});

export const updateBrandSchema = createBrandSchema.omit({ workspaceId: true, name: true }).extend({ name: z.string().trim().min(2).max(160).optional() }).partial();

export const createGuidelineSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  sourceDocumentName: z.string().trim().max(240).optional(),
  sourceText: z.string().trim().max(30000).optional(),
  rules: z.array(z.object({
    ruleKey: z.string().trim().min(2).max(80),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(2).max(1000),
    category: z.string().trim().min(2).max(80),
    severity: z.enum(["critical", "high", "medium", "low", "informational"]).default("medium"),
    evaluationInstructions: z.string().trim().min(2).max(1000),
    compliantExamples: textArray,
    noncompliantExamples: textArray,
    sourceReference: z.string().trim().max(300).optional(),
    mandatory: z.boolean().default(false),
  })).min(1).max(80),
});

export const reviewFindingSchema = z.object({
  findingId: z.string().uuid(),
  decision: z.enum(["accepted", "dismissed", "requires_review"]),
  note: z.string().trim().max(1000).optional(),
});

export const createAuditSchema = z.object({
  workspaceId: z.string().uuid(),
  brandId: z.string().uuid(),
  guidelineVersionId: z.string().uuid(),
  contentType: z.enum(["text", "social_caption", "email", "landing_page", "image" ]),
  contentText: z.string().trim().min(5).max(30000),
});
