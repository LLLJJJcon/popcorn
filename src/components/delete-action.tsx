"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./delete-action.module.css";

export function DeleteAction({ label,title,description,onConfirm,confirmLabel="Delete expression",prepare,disabled=false }: {
  readonly label:string; readonly title:string; readonly description:ReactNode;
  readonly onConfirm:()=>Promise<void>; readonly confirmLabel?:string;
  readonly prepare?:()=>Promise<void>; readonly disabled?:boolean;
}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),cancel=useRef<HTMLButtonElement>(null);
  const id=useId();
  const close=()=>{setOpen(false);setError(null);trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const element=dialog.current;
    if(element?.showModal)element.showModal();else element?.setAttribute("open","");
    cancel.current?.focus();
    return ()=>{element?.close?.();};
  },[open]);
  async function begin() {
    if(loading||busy)return;
    setError(null);setLoading(true);
    try {if(prepare)await prepare();setOpen(true);} catch {setError("Could not load the deletion details. Please try again.");}
    finally{setLoading(false);}
  }
  async function confirm() {
    if(busy)return;setBusy(true);setError(null);
    try{await onConfirm();close();}catch{setError("Could not delete this item. Please try again.");}
    finally{setBusy(false);}
  }
  return <div className={styles.action}>
    <button ref={trigger} className={styles.trigger} type="button" aria-label={label} title={loading ? "Loading deletion details…" : label} aria-busy={loading || busy} aria-haspopup="dialog" disabled={disabled||busy||loading} onClick={()=>void begin()}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>
    </button>
    {open?<dialog ref={dialog} className={styles.dialog} aria-busy={busy} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event=>{event.preventDefault();if(!busy)close();}} onClick={event=>{if(event.target===event.currentTarget&&!busy){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}} onKeyDown={event=>{
      if(event.key==="Escape"){event.preventDefault();if(!busy)close();}
      if(event.key==="Tab"){
        const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first=buttons[0],last=buttons[buttons.length-1];
        if(!first){event.preventDefault();return;}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    }}>
      <p className={styles.eyebrow}>Manage your library</p>
      <h2 id={`${id}-title`}>{title}</h2>
      <div id={`${id}-description`} className={styles.description}>{description}</div>
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      <div className={styles.actions}>
        <button ref={cancel} className={styles.cancel} type="button" disabled={busy} onClick={close}>Cancel</button>
        <button className={styles.confirm} type="button" disabled={busy} onClick={()=>void confirm()}>{busy?"Deleting…":confirmLabel}</button>
      </div>
    </dialog>:null}
    {error&&!open?<p className={styles.error} role="alert">{error}</p>:null}
  </div>;
}
