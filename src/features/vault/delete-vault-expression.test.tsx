import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DeleteVaultExpression } from "./delete-vault-expression";
const nav=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>nav}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
test.each([false,true])("deletes from list/detail (%s) only after confirmation",async detail=>{
 const fetch=vi.fn(async()=>Response.json({ok:true,data:{deleted:true}}));vi.stubGlobal("fetch",fetch);const removed=vi.fn();
 render(<DeleteVaultExpression id="entry" expression="难怪" detail={detail} onDeleted={removed}/>);
 fireEvent.click(screen.getByRole("button",{name:"Delete 难怪 from Vault"}));expect(fetch).not.toHaveBeenCalled();
 expect(screen.getByText(/cancel its scheduled reviews/)).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Delete expression"}));
 await waitFor(()=>expect(removed).toHaveBeenCalledOnce());expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/v1/vault/entry",{method:"DELETE"});
 expect(nav.refresh).toHaveBeenCalledOnce();if(detail)expect(nav.push).toHaveBeenCalledWith("/vault");else expect(nav.push).not.toHaveBeenCalled();
});
