import { handleReviewPracticeRequest } from "@/server/review-practice-runtime";
type Context={params:Promise<{reviewTaskId:string}>};
export async function GET(request:Request,context:Context){return handleReviewPracticeRequest(request,(await context.params).reviewTaskId,"get");}
export async function POST(request:Request,context:Context){return handleReviewPracticeRequest(request,(await context.params).reviewTaskId,"complete");}
