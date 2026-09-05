import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { VaultDetail } from "@/features/vault/vault-detail";
import { createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

const UserExpressionIdSchema = z.string().uuid();

export default async function VaultExpressionPage({
  params,
}: {
  readonly params: Promise<{ readonly userExpressionId: string }>;
}) {
  const runtime = await createLearningMemoryRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");

  const id = UserExpressionIdSchema.safeParse((await params).userExpressionId);
  if (!id.success) notFound();
  const detail = await runtime.repository.getVault(session.userId, id.data);
  if (!detail) notFound();

  return <VaultDetail card={detail.card} suggestions={detail.suggestions} />;
}
