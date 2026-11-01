import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi, afterEach } from "vitest";
import { CandidateList, type CandidateArtifact } from "./candidate-list";
import type { CandidateExpression } from "@/contracts/knowledge";
const nav=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>nav}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
const ITEM="22222222-2222-4222-8222-222222222222",ART="33333333-3333-4333-8333-333333333333";
const candidate=(expression:string):CandidateExpression=>({expression,englishMeaning:"A useful expression.",englishExplanation:"Use it in conversation.",tone:"casual",communicativeFunction:"react",register:"spoken",evidenceText:expression,segmentIds:["a".repeat(64)],startSeconds:1,endSeconds:2,confidence:0.9});
const artifact:CandidateArtifact={artifactId:ART,savedItemId:ITEM,candidates:[candidate("太离谱了"),candidate("难怪")]};
const props={savedItemId:ITEM,videoSourceId:"source",youtubeUrl:"https://www.youtube.com/watch?v=HkN9wpiOnAg",analysis:{state:"ready" as const,artifact}};
test("deleting one card keeps the next card's original practice index and persists on refresh",async()=>{
 const fetch=vi.fn(async(url:unknown)=>String(url).includes("/expressions/")?Response.json({ok:true,data:{deleted:true,key:"legacy:太离谱了"}}):Response.json({ok:false},{status:500}));vi.stubGlobal("fetch",fetch);
 vi.useFakeTimers();const view=render(<CandidateList {...props}/>);
 await act(async()=>vi.advanceTimersByTimeAsync(0));vi.useRealTimers();
 await waitFor(()=>expect(screen.getByRole("button",{name:"Delete 太离谱了 from Saved"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"Delete 太离谱了 from Saved"}));
 fireEvent.click(screen.getByRole("button",{name:"Delete expression"}));
 await waitFor(()=>expect(screen.queryByRole("heading",{name:"太离谱了"})).not.toBeInTheDocument());
 expect(fetch.mock.calls[0]?.[0]).toBe(`/api/v1/saved-items/${ITEM}/expressions/${ART}/0`);
 fireEvent.click(screen.getByRole("button",{name:"Practice this expression"}));
 await screen.findByRole("alert");
 expect(JSON.parse(String((fetch.mock.calls as unknown[][])[1]?.[1] && ((fetch.mock.calls as unknown[][])[1]?.[1] as RequestInit).body))).toMatchObject({candidateIndex:1});
 // A fresh server render has the same durable key even if analysis produced a new artifact.
 view.unmount();render(<CandidateList {...props} analysis={{state:"ready",artifact:{...artifact,artifactId:"44444444-4444-4444-8444-444444444444"}}} item={{id:ITEM,kind:"player_moment",status:"ready",capturedAt:"2026-11-01T00:00:00Z",startSeconds:1,rawText:"太离谱了，难怪",englishTranslation:null,youtubeUrl:props.youtubeUrl,removedExpressionKeys:["legacy:太离谱了"]}}/>);
 expect(screen.queryByRole("heading",{name:"太离谱了"})).not.toBeInTheDocument();expect(screen.getByRole("heading",{name:"难怪"})).toBeInTheDocument();
});
test("retains the card and source when its deletion fails",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json({ok:false},{status:500})));
 vi.useFakeTimers();render(<CandidateList {...props}/>);await act(async()=>vi.advanceTimersByTimeAsync(0));vi.useRealTimers();
 await waitFor(()=>expect(screen.getByRole("button",{name:"Delete 太离谱了 from Saved"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"Delete 太离谱了 from Saved"}));fireEvent.click(screen.getByRole("button",{name:"Delete expression"}));
 expect(await screen.findByRole("alert")).toHaveTextContent(/try again/);expect(screen.getByRole("heading",{name:"太离谱了"})).toBeInTheDocument();
 expect(within(screen.getByRole("dialog")).getByRole("button",{name:"Delete expression"})).toBeEnabled();
});
