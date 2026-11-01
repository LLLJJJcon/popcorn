import { handlePracticeRoundMutation } from "@/server/practice-round-runtime";
export async function POST(request:Request,context:{params:Promise<{taskId:string}>}){
  return handlePracticeRoundMutation(request,(await context.params).taskId,"examples");
}
