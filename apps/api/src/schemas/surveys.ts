import { z } from "zod";

const uuid = z.string().uuid();
const questionType = z.enum(["single_choice", "multiple_choice", "rating", "short_text", "long_text", "yes_no", "nps", "demographic"]);

export const surveyQuestionSchema = z.object({
  questionType,
  prompt: z.string().trim().min(3).max(1000),
  options: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  position: z.number().int().min(0),
  required: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

const surveyFieldsSchema = z.object({
  workspaceId: uuid,
  brandId: uuid,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  coverImageUrl: z.string().url().max(2000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  audience: z.string().trim().min(2).max(80).default("public"),
  anonymous: z.boolean().default(false),
  maxResponses: z.number().int().min(1).max(1000000).nullable().optional(),
  thankYouMessage: z.string().trim().min(3).max(500).default("Thank you for sharing your feedback."),
  questions: z.array(surveyQuestionSchema).min(1).max(50),
});

export const createSurveySchema = surveyFieldsSchema.superRefine((value, context) => {
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date must be after the start date." });
  const positions = value.questions.map((question) => question.position);
  if (new Set(positions).size !== positions.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions"], message: "Question positions must be unique." });
});

export const updateSurveySchema = surveyFieldsSchema.omit({ workspaceId: true, brandId: true }).partial().extend({ questions: z.array(surveyQuestionSchema).min(1).max(50).optional() });
export const surveyIdParamSchema = z.object({ surveyId: uuid });
export const responseAnswerSchema = z.object({ questionId: uuid, value: z.union([z.string().max(5000), z.number(), z.boolean(), z.array(z.string().max(500)).max(50)]) });
export const submitSurveySchema = z.object({ answers: z.array(responseAnswerSchema), anonymousSessionKey: z.string().trim().min(8).max(160).optional() });
