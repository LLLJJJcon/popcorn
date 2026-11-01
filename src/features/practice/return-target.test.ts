import { describe, expect, test } from "vitest";
import { resolvePracticeReturnTarget } from "./return-target";
const id="11111111-1111-4111-8111-111111111111";
describe("practice return whitelist",()=>{
 test.each([[`/saved/${id}#saved-item-${id}`,"Saved"],[`/saved/${id}`,"Saved"],["/practice?session=active&from=home","Today's practice"],[`/vault/${id}`,"Vault"],["/home","Home"]])("allows %s",(href,label)=>expect(resolvePracticeReturnTarget(href)).toEqual({href,label}));
 test.each([undefined,["/home"],"https://evil.test/home","//evil.test/home","/\\evil.test/home","/%2f%2fevil.test","/saved/../home","/home?redirect=evil","/practice/../../home","/practice?x=%0d%0aLocation:evil","/vault/not-a-uuid","javascript:alert(1)"])("rejects unsafe or unlisted %j",value=>expect(resolvePracticeReturnTarget(value)).toEqual({href:"/saved",label:"Saved"}));
});
