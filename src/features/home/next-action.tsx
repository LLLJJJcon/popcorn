import type { HomeView } from "@/features/home/home-view";

export type HomeNextAction =
  | { readonly kind: "gateway"; readonly href: "/settings/model-gateway" }
  | { readonly kind: "practice"; readonly href: "/practice/session"; readonly estimatedMinutes: number }
  | { readonly kind: "saved"; readonly href: "/saved?filter=needs-analysis"; readonly count: number }
  | { readonly kind: "youtube"; readonly href: "https://www.youtube.com/" };

export function selectNextAction(view: HomeView): HomeNextAction {
  if (!view.hasActiveGateway) return { kind: "gateway", href: "/settings/model-gateway" };
  if (view.summary.reviewCount + view.summary.secondTryCount + view.summary.newCount > 0) {
    return { kind: "practice", href: "/practice/session", estimatedMinutes: view.summary.estimatedMinutes };
  }
  if (view.summary.needsAnalysisCount > 0) {
    return { kind: "saved", href: "/saved?filter=needs-analysis", count: view.summary.needsAnalysisCount };
  }
  return { kind: "youtube", href: "https://www.youtube.com/" };
}

export function NextAction({
  action,
  className,
}: {
  readonly action: HomeNextAction;
  readonly className?: string;
}) {
  const label = action.kind === "gateway"
    ? "Set up model gateway"
    : action.kind === "practice"
      ? "Start today's practice"
      : action.kind === "saved"
        ? `Analyze ${action.count} saves`
        : "Watch something on YouTube";
  return <a className={className} href={action.href}>{label}{action.kind === "youtube" ? <span aria-hidden="true"> ↗</span> : null}</a>;
}
