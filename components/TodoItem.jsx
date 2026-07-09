"use client";

import { useState, useRef, useTransition } from "react";
import {
  toggleTodoAction,
  deleteTodoAction,
  insertTodoAction,
} from "../app/actions.js";
import { formatTime } from "../lib/format.js";

export default function TodoItem({ todo, list, homeMode }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false); // 樂觀刪除 + 可復原
  const undoTimer = useRef(null);

  function doDelete() {
    setRemoved(true);
    start(() => deleteTodoAction(list.id, todo.id));
    // 復原視窗過後就讓它自然消失（下次資料刷新即不再出現）
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(false), 6000);
  }

  function undo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(false);
    // 用原本的 id / 時間還原（id 相同 → store 冪等，不會產生重複）
    start(() =>
      insertTodoAction(
        list.id,
        {
          id: todo.id,
          text: todo.text,
          done: todo.done,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        },
        null
      )
    );
  }

  if (removed) {
    return (
      <div className="todo-undo" role="status">
        <span className="undo-text">已刪除「{todo.text}」</span>
        <button type="button" className="undo-btn" onClick={undo}>
          復原
        </button>
      </div>
    );
  }

  return (
    <div className={`todo${todo.done ? " done" : ""}${pending ? " pending" : ""}`}>
      <button
        type="button"
        className={`check${todo.done ? " checked" : ""}`}
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? "標記為未完成" : "標記為完成"}
        onClick={() => start(() => toggleTodoAction(list.id, todo.id, !todo.done))}
      />

      <div className="todo-body">
        <div className="todo-text">{todo.text}</div>
        <div className="todo-meta">
          {homeMode && (
            <span className="origin">
              <span className="dot" style={{ background: list.color }} />
              {list.name}
            </span>
          )}
          <span suppressHydrationWarning>{formatTime(todo.createdAt)}</span>
        </div>
      </div>

      <button
        type="button"
        className="todo-del"
        title="刪除"
        aria-label="刪除這筆待辦"
        onClick={doDelete}
      >
        ✕
      </button>
    </div>
  );
}
