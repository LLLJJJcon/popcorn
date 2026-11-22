"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedItemView } from "./api";
import { CandidateList, type CandidateAnalysis } from "./candidate-list";
import { DeleteSavedMoment } from "./delete-saved-moment";
import type { SavedHighlight } from "@/contracts/highlights";
import { SavedSentencePreview } from "./saved-sentence-preview";
import { ProcessingState } from "./processing-state";
import { useSavedWorkspaceScroll } from "./use-saved-workspace-scroll";
import styles from "./saved-workspace.module.css";

function timestamp(seconds: number | null) {
  if (seconds === null) return "Video";
  const n = Math.max(0, Math.floor(seconds));
  return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2,"0")}:${String(n % 60).padStart(2,"0")}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2,"0")}`;
}
function SentenceRow({ item, active, sourceId, onSelect, onTarget }: { readonly item: SavedItemView; readonly active: boolean; readonly sourceId: string; readonly onSelect: (id: string) => void; readonly onTarget: (id: string, node: HTMLDivElement | null) => void }) {
  const setTarget = useCallback((node: HTMLDivElement | null) => onTarget(item.id, node), [item.id, onTarget]);
  const editable = item.status === "ready" && item.kind !== "video" && Boolean(item.targetSegments?.length);
  return <li className={styles.sentenceRow} data-selected={active} id={`saved-item-${item.id}`}>
    <div className={styles.sentenceToolbar}><button className={styles.sentenceSelect} type="button" aria-label={`Select sentence ${timestamp(item.startSeconds)}: ${item.rawText}`} aria-pressed={active} onClick={() => onSelect(item.id)}>{timestamp(item.startSeconds)}</button><span className={styles.sentenceActions}><a href={item.youtubeUrl} target="_blank" rel="noreferrer" aria-label={`Watch sentence ${timestamp(item.startSeconds)} on YouTube`} className={styles.sentenceWatch}><svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="m6 3 11 7-11 7z" /></svg></a><DeleteSavedMoment sourceId={sourceId} savedItemId={item.id}/></span></div>
    {(!active || !editable) ? <button className={styles.sentenceTextButton} type="button" onClick={() => onSelect(item.id)} aria-label={`Open learning cards for ${timestamp(item.startSeconds)}`}><SavedSentencePreview item={item} /></button> : null}
    {(!active || !editable) && item.englishTranslation ? <p className={styles.translation}>{item.englishTranslation}</p> : null}
    <div ref={setTarget} hidden={!active || !editable} />
    {item.status !== "ready" ? <ProcessingState state={item.status}/> : null}
  </li>;
}
export function SavedLearningWorkspace({items,analyses,videoSourceId,youtubeUrl}:{readonly items:readonly SavedItemView[];readonly analyses:Readonly<Record<string,CandidateAnalysis>>;readonly videoSourceId:string;readonly youtubeUrl:string}) {
  const workspaceRef=useRef<HTMLDivElement>(null);
  useSavedWorkspaceScroll(workspaceRef, items.length > 0);
  const [selectedId,setSelectedId]=useState(items[0]?.id ?? "");
  const [localHighlights,setLocalHighlights]=useState<Record<string,{source:readonly SavedHighlight[]|undefined;values:readonly SavedHighlight[]}>>({});
  const [targets,setTargets]=useState<Record<string,HTMLDivElement|null>>({});
  const selected=items.find(item=>item.id===selectedId) ?? items[0];
  const setTarget=useCallback((id:string,node:HTMLDivElement|null)=>setTargets(current=>current[id]===node?current:{...current,[id]:node}),[]);
  useEffect(()=>{function followHash(){try{const id=decodeURIComponent(location.hash.replace(/^#saved-item-/,""));if(items.some(item=>item.id===id))setSelectedId(id)}catch{/* Ignore malformed external anchors. */}}followHash();window.addEventListener("hashchange",followHash);return()=>window.removeEventListener("hashchange",followHash)},[items]);
  function selectSentence(id:string){
    setSelectedId(id);
    const url=new URL(window.location.href);url.hash=`saved-item-${id}`;
    window.history.replaceState(window.history.state,"",url);
  }
  if(!items.length)return <p className={styles.sourceGuidance}>No saved sentences yet. Save a moment from the extension to begin.</p>;
  return <div ref={workspaceRef} className={styles.learningWorkspace} data-scroll-phase="source">
    <section className={styles.sentenceColumn} aria-label="Saved sentences"><div className={styles.sentenceColumnHeading}><h3>Saved sentences</h3><span>{items.length}</span></div><p className={styles.sourceGuidance}>Choose a sentence. Mark words directly in the original text.</p><ol className={styles.sentenceList} tabIndex={0} aria-label="Scroll saved sentences">{items.map(item=><SentenceRow key={item.id} item={localHighlights[item.id] && localHighlights[item.id]!.source===item.highlights?{...item,highlights:localHighlights[item.id]!.values}:item} active={item.id===selected?.id} sourceId={videoSourceId} onSelect={selectSentence} onTarget={setTarget}/>)}</ol></section>
    <section className={styles.learningPane} tabIndex={0} aria-label="Learning cards for selected sentence"><p className={styles.selectedMoment}>Sentence at {timestamp(selected?.startSeconds ?? null)}</p><h3 className={styles.learningPaneTitle}>Pick it up. Make it yours.</h3>{items.map(item=><div key={item.id} hidden={item.id!==selected?.id}><CandidateList savedItemId={item.id} videoSourceId={videoSourceId} youtubeUrl={youtubeUrl} item={item} analysis={analyses[item.id] ?? {state:"missing"}} editorTarget={targets[item.id] ?? null} onHighlightsChange={next=>setLocalHighlights(current=>({...current,[item.id]:{source:item.highlights,values:next}}))}/></div>)}</section>
  </div>;
}
