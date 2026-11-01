"use client";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
export function DeleteSavedMoment({sourceId,savedItemId}:{readonly sourceId:string;readonly savedItemId:string}) {
 const router=useRouter();
 return <DeleteAction label="Delete saved moment" title="Delete this saved moment?" confirmLabel="Delete moment" description={<p>It will be removed from Saved. Your practice history, mastery, and reviews will stay.</p>} onConfirm={async()=>{
  const response=await fetch(`/api/v1/saved/${sourceId}/moments/${savedItemId}`,{method:"DELETE"});
  const result=await response.json();if(!response.ok||!result.ok||result.data?.deleted!==true)throw new Error("deletion failed");
  if(result.data.remainingCount===0)router.push("/saved");router.refresh();
 }}/>;
}
