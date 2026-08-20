import type { DuePracticeView } from "@/server/repositories/review-task-repository";

export function DuePractice({ tasks }: { readonly tasks: readonly DuePracticeView[] }) {
  return (
    <section>
      <h1>Practice</h1>
      {tasks.length === 0
        ? <p>No Practice is due. Keep learning from your saved YouTube moments.</p>
        : <ul>{tasks.map((task) => (
          <li key={task.reviewTaskId}>
            <a href={`/vault#expression-${task.userExpressionId}`}>Practice {task.expression}</a>
            <p>{task.englishMeaning} · {task.masteryState} · due {task.dueAt}</p>
          </li>
        ))}</ul>}
    </section>
  );
}
