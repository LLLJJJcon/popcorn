"use client";
import { useState, type ReactNode } from "react";
import styles from "./saved-workspace.module.css";
export function SavedDetailPanels({children,overview}:{readonly children:ReactNode;readonly overview:ReactNode}) {
  const [tab,setTab]=useState<"moments"|"overview">("moments");
  return <div className={styles.detailPanels}>
    <div className={styles.detailTabs} aria-label="Video views">
      <button type="button" aria-pressed={tab==="moments"} onClick={()=>setTab("moments")}>Saved moments</button>
      {overview ? <button type="button" aria-pressed={tab==="overview"} onClick={()=>setTab("overview")}>Video overview</button>:null}
    </div>
    <div className={styles.detailTabContent} hidden={tab!=="moments"}>{children}</div>
    {overview?<div className={styles.overviewTab} hidden={tab!=="overview"}>{overview}</div>:null}
  </div>;
}
