"use client";

import { useTransition } from "react";
import { toggleTodoAction, deleteTodoAction } from "../app/actions.js";
import { formatTime } from "../lib/format.js";

export default function TodoItem({ todo, list, homeMode }) {
  const [pending, start] = useTransition();

  return (
    <div className={`todo${todo.done ? " done" : ""}${pending ? " pending" : ""}`}>
      <button
        type="button"
        className={`check${todo.done ? " checked" : ""}`}
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? "標記為未完成" : "標記為完成"}
        onClick={() => start(() => toggleTodoAction(list.id, todo.id))}
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
          <span>{formatTime(todo.createdAt)}</span>
        </div>
      </div>

      <button
        type="button"
        className="todo-del"
        title="刪除"
        onClick={() => start(() => deleteTodoAction(list.id, todo.id))}
      >
        ✕
      </button>
    </div>
  );
}
