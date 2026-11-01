"use client";
import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import styles from "./practice-workspace.module.css";
export function DisclosureButton({ children, expanded, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { readonly expanded: boolean }) {
  return <button type="button" className={styles.disclosureButton} aria-expanded={expanded} {...props}><span aria-hidden="true">＋</span>{children}<span className={styles.disclosureArrow} aria-hidden="true">⌄</span></button>;
}
export function formatPracticeDate(value: string): string { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }

export function LocalPracticeDate({value}:{readonly value:string}){const[label,setLabel]=useState("");useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)setLabel(formatPracticeDate(value));});return()=>{mounted=false;};},[value]);return <time dateTime={value}>{label}</time>;}
