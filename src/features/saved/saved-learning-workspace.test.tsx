import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { useState } from "react";
import type { SavedItemView } from "./api";
import { SavedLearningWorkspace } from "./saved-learning-workspace";
vi.mock("./delete-saved-moment", () => ({ DeleteSavedMoment: () => null }));
vi.mock("./candidate-list", () => ({ CandidateList: ({ item, editorTarget }: { item: SavedItemView; editorTarget: HTMLElement | null }) => {
  const [draft, setDraft] = useState("");
  return <>{editorTarget ? createPortal(<label>Mark words in {item.rawText}<input aria-label={`Selection ${item.id}`} value={draft} onChange={e => setDraft(e.target.value)} /></label>, editorTarget) : null}<p>Learning card for {item.rawText}</p></>;
} }));
const items: SavedItemView[] = [{ id:"one",kind:"subtitle_row",status:"ready",capturedAt:"2026-11-22T00:00:00Z",startSeconds:12,rawText:"第一句话",englishTranslation:null,targetSegments:[{id:"s1",text:"原句",startSeconds:0,endSeconds:2}],youtubeUrl:"https://www.youtube.com/watch?v=abcdefghijk&t=12s" },{ id:"two",kind:"subtitle_row",status:"ready",capturedAt:"2026-11-22T00:00:01Z",startSeconds:24,rawText:"第二句话",englishTranslation:null,targetSegments:[{id:"s1",text:"原句",startSeconds:0,endSeconds:2}],youtubeUrl:"https://www.youtube.com/watch?v=abcdefghijk&t=24s" }];
it("selects a sentence, moves its editor into the source column and retains per-sentence state",async()=>{
  render(<SavedLearningWorkspace items={items} analyses={{}} videoSourceId="video" youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"/>);
  const sources=screen.getByRole("region",{name:"Saved sentences"});
  expect(within(sources).getByLabelText("Selection one")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Selection one"),"marked");
  await userEvent.click(screen.getByRole("button",{name:/Select sentence 0:24/}));
  expect(screen.getByText("Learning card for 第二句话")).toBeVisible();
  expect(screen.getByText("Learning card for 第一句话")).not.toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:/Select sentence 0:12/}));
  expect(screen.getByLabelText("Selection one")).toHaveValue("marked");
});
it("has an actionable empty source state",()=>{
  render(<SavedLearningWorkspace items={[]} analyses={{}} videoSourceId="video" youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"/>);
  expect(screen.getByText(/No saved sentences yet/)).toBeVisible();
});

it("shows the saved word marks on an unselected sentence",()=>{
  const second={...items[1]!,targetSegments:[{id:"s1",text:"第二句话",startSeconds:24,endSeconds:26}],highlights:[{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",savedItemId:"two",startSegmentId:"s1",endSegmentId:"s1",startOffset:0,endOffset:2,text:"第二",origin:"user" as const,status:"active" as const,reasonEn:null}]};
  render(<SavedLearningWorkspace items={[items[0]!,second]} analyses={{}} videoSourceId="video" youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"/>);
  expect(screen.getByText("第二",{selector:"mark"})).toBeVisible();
});
it("keeps the newly selected sentence after a server refresh with a return anchor",async()=>{
  history.replaceState(null,"","#saved-item-one");
  const props={items,analyses:{},videoSourceId:"video",youtubeUrl:"https://www.youtube.com/watch?v=abcdefghijk"};
  const {rerender}=render(<SavedLearningWorkspace {...props}/>);
  await userEvent.click(screen.getByRole("button",{name:/Select sentence 0:24/}));
  rerender(<SavedLearningWorkspace {...props} items={[...items]}/>);
  expect(screen.getByText("Learning card for 第二句话")).toBeVisible();
  history.replaceState(null,"","/");
});
it("retains a timestamped source link for failed moments",()=>{
  render(<SavedLearningWorkspace items={[{...items[0]!,status:"failed"}]} analyses={{}} videoSourceId="video" youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"/>);
  expect(screen.getByRole("link",{name:"Watch sentence 0:12 on YouTube"})).toHaveAttribute("href",items[0]!.youtubeUrl);
});
