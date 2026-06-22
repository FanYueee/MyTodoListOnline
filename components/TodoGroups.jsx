import { formatDayLabel } from "../lib/format.js";
import TodoItem from "./TodoItem.jsx";

// 伺服器元件：渲染日期分隔線 + 每筆待辦
export default function TodoGroups({ groups, homeMode }) {
  if (!groups.length) {
    return (
      <div className="empty">
        {homeMode ? (
          <>目前沒有未完成的待辦 🎉<br />到下方清單新增吧</>
        ) : (
          <>這個清單還沒有待辦<br />在上方輸入並按 Enter 新增</>
        )}
      </div>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <section key={g.key}>
          <div className="day-sep">
            <span>{formatDayLabel(g.key)}</span>
          </div>
          {g.items.map(({ todo, list }) => (
            <TodoItem key={todo.id} todo={todo} list={list} homeMode={homeMode} />
          ))}
        </section>
      ))}
    </>
  );
}
