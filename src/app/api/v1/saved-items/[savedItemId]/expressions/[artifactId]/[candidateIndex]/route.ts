import { createExpressionDeletionRuntime } from "@/server/repositories/expression-removal-repository";
export async function DELETE(request: Request, context: { readonly params: Promise<{savedItemId:string;artifactId:string;candidateIndex:string}> }) {
  const {savedItemId,artifactId,candidateIndex}=await context.params;
  return (await createExpressionDeletionRuntime()).saved(request,savedItemId,artifactId,candidateIndex);
}
