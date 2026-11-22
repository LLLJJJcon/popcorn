import { render,screen } from "@testing-library/react";
import { SavedSentencePreview } from "./saved-sentence-preview";
it("shows marks in the full source sentence when the original capture was only a fragment",()=>{
  render(<SavedSentencePreview item={{id:"save",kind:"subtitle_selection",status:"ready",capturedAt:"2026-11-22T00:00:00Z",startSeconds:12,rawText:"挺靠谱",englishTranslation:null,youtubeUrl:"https://www.youtube.com/watch?v=abcdefghijk",targetSegments:[{id:"s1",text:"我觉得这个办法挺靠谱。",startSeconds:12,endSeconds:15}],highlights:[{id:"mark",savedItemId:"save",startSegmentId:"s1",endSegmentId:"s1",startOffset:7,endOffset:10,text:"挺靠谱",origin:"user",status:"active",reasonEn:null}]}}/>);
  expect(screen.getByText("挺靠谱",{selector:"mark"})).toBeVisible();
  expect(screen.getByTestId("raw-text")).toHaveTextContent("我觉得这个办法挺靠谱。");
  expect(screen.getByText(/Saved selection:/)).toHaveTextContent("挺靠谱");
});
