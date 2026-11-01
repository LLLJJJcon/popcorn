import { handleReviewPracticeRequest } from "@/server/review-practice-runtime";
export async function POST(request:Request,context:{params:Promise<{reviewTaskId:string}>}){return handleReviewPracticeRequest(request,(await context.params).reviewTaskId,"reveal");}
