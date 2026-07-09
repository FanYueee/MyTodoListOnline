import { redirect } from "next/navigation";
import { getList, getAllLists } from "../../../lib/store.js";
import TabBar from "../../../components/TabBar.jsx";
import Editor from "../../../components/Editor.jsx";

export const dynamic = "force-dynamic";

export default async function ListPage(props) {
  const params = await props.params;
  // Next 不會自動解碼路由參數，含中文的清單 id 需手動解碼
  const id = decodeURIComponent(params.id);

  const list = await getList(id);
  if (!list) redirect("/");

  const lists = await getAllLists();
  // 由上而下＝清單順序（保留插入位置，不再依 createdAt 重排）
  const todos = list.todos;
  const left = list.todos.filter((t) => !t.done).length;

  return (
    <div className="app">
      <header className="topbar">
        <h1>{list.name}</h1>
        <span className="subtitle">
          {left ? `${left} 筆未完成` : "全部完成 🎉"}
        </span>
      </header>

      <main className="todo-area">
        <Editor listId={list.id} initialTodos={todos} />
      </main>

      <TabBar lists={tabData(lists)} activeId={list.id} />
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
