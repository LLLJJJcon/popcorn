"use client";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
export function DeleteVaultExpression({id,expression,detail=false,onDeleted}:{readonly id:string;readonly expression:string;readonly detail?:boolean;readonly onDeleted?:()=>void}) {
  const router=useRouter();
  return <DeleteAction label={`Delete ${expression} from Vault`} title={`Delete “${expression}” from Vault?`} description={<p>Remove this expression from your Vault and cancel its scheduled reviews. Your past practice history and saved source will stay.</p>} onConfirm={async()=>{
    const response=await fetch(`/api/v1/vault/${id}`,{method:"DELETE"});
    const body=await response.json();if(!response.ok||body.ok!==true||body.data?.deleted!==true)throw new Error("deletion failed");
    onDeleted?.();if(detail)router.push("/vault");router.refresh();
  }}/>;
}
