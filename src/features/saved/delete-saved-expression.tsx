"use client";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
export function DeleteSavedExpression({savedItemId,artifactId,index,expression,onDeleted,disabled}:{readonly savedItemId:string;readonly artifactId:string;readonly index:number;readonly expression:string;readonly onDeleted:(key:string)=>void;readonly disabled?:boolean}) {
  const router=useRouter();
  return <DeleteAction label={`Delete ${expression} from Saved`} title={`Delete “${expression}” from Saved?`} disabled={disabled} description={<p>This learning card will be removed from Saved. The original sentence, your Vault and practice history will stay.</p>} onConfirm={async()=>{
    const response=await fetch(`/api/v1/saved-items/${savedItemId}/expressions/${artifactId}/${index}`,{method:"DELETE"});
    const body=await response.json();if(!response.ok||body.ok!==true||body.data?.deleted!==true||typeof body.data.key!=="string")throw new Error("deletion failed");
    onDeleted(body.data.key);router.refresh();
  }}/>;
}
