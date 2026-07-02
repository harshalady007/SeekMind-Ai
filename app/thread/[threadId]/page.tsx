import { notFound } from "next/navigation";
import { z } from "zod";
import { ThreadView } from "@/components/thread/thread-view";
import {
  answerLengthSchema,
  newsTimeRangeSchema,
  searchModeSchema,
} from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

const newSearchParamsSchema = z.object({
  q: z.string().min(1).max(2000),
  mode: searchModeSchema.catch("quick"),
  len: answerLengthSchema.catch("balanced"),
  range: newsTimeRangeSchema.optional().catch(undefined),
  spaceId: z.string().uuid().optional().catch(undefined),
});

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { threadId } = await params;

  if (threadId === "new") {
    const raw = await searchParams;
    const parsed = newSearchParamsSchema.safeParse(raw);
    if (!parsed.success) notFound();
    return (
      <ThreadView
        initial={{
          query: parsed.data.q,
          mode: parsed.data.mode,
          answerLength: parsed.data.len,
          timeRange: parsed.data.range,
          spaceId: parsed.data.spaceId,
        }}
      />
    );
  }

  if (!uuidSchema.safeParse(threadId).success) notFound();
  return <ThreadView threadId={threadId} />;
}
