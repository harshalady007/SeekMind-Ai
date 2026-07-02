import { z } from "zod";
import {
  ANSWER_LENGTHS,
  NEWS_TIME_RANGES,
  SEARCH_MODES,
  type AnswerLength,
  type NewsTimeRange,
  type SearchMode,
} from "@/lib/core/types";
import { MAX_QUERY_LENGTH } from "@/lib/retrieval/normalize";

export const searchModeSchema = z.enum(SEARCH_MODES as [SearchMode, ...SearchMode[]]);
export const answerLengthSchema = z.enum(
  ANSWER_LENGTHS as [AnswerLength, ...AnswerLength[]],
);
export const newsTimeRangeSchema = z.enum(
  NEWS_TIME_RANGES as [NewsTimeRange, ...NewsTimeRange[]],
);

export const MAX_FOLLOW_UP_LENGTH = 2_000;

export const startSearchSchema = z.object({
  /** Client-generated id used only for cancellation routing. */
  searchId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  mode: searchModeSchema.default("quick"),
  answerLength: answerLengthSchema.default("balanced"),
  timeRange: newsTimeRangeSchema.optional(),
  /** Present for follow-ups and regeneration. */
  threadId: z.string().uuid().optional(),
  /** Regenerate the last answer instead of adding a new user turn. */
  regenerate: z.boolean().optional().default(false),
  /** Launch the search inside a workspace (applies its instructions). */
  spaceId: z.string().uuid().optional(),
});
export type StartSearchInput = z.infer<typeof startSearchSchema>;

export const cancelSearchSchema = z.object({
  searchId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export const listThreadsSchema = z.object({
  query: z.string().max(200).optional(),
  mode: searchModeSchema.optional(),
  savedOnly: z.coerce.boolean().optional(),
  spaceId: z.string().uuid().nullable().optional(),
  since: z.string().datetime().optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const updateThreadSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    isSaved: z.boolean().optional(),
    spaceId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" });

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1_000).default(""),
  customInstructions: z.string().max(4_000).default(""),
});

export const updateSpaceSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1_000).optional(),
    customInstructions: z.string().max(4_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" });

export const updateProfileSchema = z
  .object({
    displayName: z.string().max(100).nullable().optional(),
    defaultMode: searchModeSchema.optional(),
    defaultAnswerLength: answerLengthSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" });
