import { getAllLists } from "../lib/store.js";
import { groupByDay } from "../lib/format.js";
import TabBar from "../components/TabBar.jsx";
import TodoGroups from "../components/TodoGroups.jsx";
import AutoRefresh from "../components/AutoRefresh.jsx";

// 永遠在請求當下讀取檔案，確保資料最新
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const lists = await getAllLists();

  // 主頁：彙整所有清單中「尚未完成」的待辦
  // 只帶清單的 id/name/color 給 client 元件，避免把整份（含已完成）待辦序列化到前端
  const entries = [];
  for (const list of lists) {
    const slim = { id: list.id, name: list.name, color: list.color };
    for (const todo of list.todos) {
      if (!todo.done) entries.push({ todo, list: slim });
    }
  }
  const groups = groupByDay(entries);
  const openCount = entries.length;

  return (
    <div className="app">
      <AutoRefresh />
      <header className="topbar">
        <h1>主頁</h1>
        <span className="subtitle">
          {openCount ? `${openCount} 筆未完成` : "全部完成 🎉"}
        </span>
      </header>

      <main className="todo-area">
        <TodoGroups groups={groups} homeMode />
      </main>

      <TabBar lists={tabData(lists)} activeId="home" />
    </div>
  );
}

function tabData(lists) {
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    openCount: l.todos.filter((t) => !t.done).length,
  }));
}
