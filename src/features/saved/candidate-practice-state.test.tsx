import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { CandidateExpression, SavedPracticeState } from "@/contracts/knowledge";
import { CandidateExpressionCard } from "./candidate-expression";
const id="11111111-1111-4111-8111-111111111111";
const candidate:CandidateExpression={expression:"太离谱了",englishMeaning:"Outrageous",englishExplanation:"React to an unreasonable situation.",tone:"Casual",communicativeFunction:"Complain",register:"Informal",evidenceText:"这个价格太离谱了。",segmentIds:["seg-1"],startSeconds:1,endSeconds:3,confidence:.9};
afterEach(cleanup);
const card=(practiceState?:SavedPracticeState)=>render(<CandidateExpressionCard candidate={{...candidate,practiceState}} canonicalUrl="https://www.youtube.com/watch?v=abcdefghijk" disabled={false} activating={false} onUse={()=>{}}/>);
test("practicing shows status and Continue",()=>{card({status:"practicing",taskId:id,roundNumber:2});expect(screen.getByText("Practicing · Not in Vault yet")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Continue"})).toBeInTheDocument();});
test("removed shows Practice",()=>{card({status:"removed",taskId:id,roundNumber:2});expect(screen.getByText("Removed from practice")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Practice"})).toBeInTheDocument();});
test("promoted links directly to Vault",()=>{card({status:"promoted",userExpressionId:id});expect(screen.getByRole("link",{name:"In your Vault"})).toHaveAttribute("href",`/vault/${id}`);expect(screen.queryByRole("button",{name:/Practice/})).not.toBeInTheDocument();});
test("unpracticed retains Practice this expression",()=>{card({status:"unpracticed"});expect(screen.getByRole("button",{name:"Practice this expression"})).toBeInTheDocument();});

test("archived promotion retains history without a dead Vault link",()=>{card({status:"promoted",userExpressionId:id,removedFromVault:true});expect(screen.getByText("Removed from Vault")).toBeInTheDocument();expect(screen.queryByRole("link",{name:"In your Vault"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:/Practice/})).not.toBeInTheDocument();});
