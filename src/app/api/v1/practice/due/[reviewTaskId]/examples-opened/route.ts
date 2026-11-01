import { handlePracticeRoundMutation } from "@/server/practice-round-runtime";
export async function POST(request:Request,context:{params:Promise<{reviewTaskId:string}>}){
  return handlePracticeRoundMutation(request,(await context.params).reviewTaskId,"due-examples");
}
