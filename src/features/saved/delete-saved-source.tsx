"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import type { DeletionImpact } from "@/server/domain/plan-source-deletion";
export function DeleteSavedSource({sourceId,title}:{readonly sourceId:string;readonly title:string}) {
 const router=useRouter();const [impact,setImpact]=useState<DeletionImpact|null>(null);
 return <DeleteAction label={`Delete saved video ${title}`} title={`Delete “${title}”?`} confirmLabel="Delete video" prepare={async()=>{
   const response=await fetch(`/api/v1/saved/${sourceId}/delete-preview`,{cache:"no-store"});const body=await response.json();
   if(!response.ok||body.ok!==true||body.data?.videoSourceId!==sourceId||!["remove_unpracticed_source","remove_source_keep_evidence"].includes(body.data?.mode))throw new Error("preview failed");
   setImpact(body.data);
 }} description={<><p>This removes {impact?.savedCount} saved moments and their source content from Saved.</p><p>{impact?.mode==="remove_source_keep_evidence"?`${impact.affectedExpressionCount} practiced expressions will stay in Vault with their history and reviews. Their source links and evidence will be removed.`:"This video has no practiced expressions that need to be retained."}</p></>} onConfirm={async()=>{
   if(!impact)throw new Error("missing preview");
   const response=await fetch(`/api/v1/saved/${sourceId}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:impact.mode})});
   if(!response.ok)throw new Error("deletion failed");router.push("/saved");router.refresh();
 }}/>;
}
