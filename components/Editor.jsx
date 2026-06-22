"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { saveTodosAction } from "../app/actions.js";
import { formatTime, formatDayLabel, dayKey } from "../lib/format.js";

// 產生本地 id（不依賴 crypto.randomUUID，於非 https 的區網 IP 也可用）
function genId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function newTodo(text = "") {
  return {
    id: genId(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export default function Editor({ listId, initialTodos }) {
  // 本地狀態為編輯時的單一真實來源；結尾永遠保留一行空白可輸入
  const [todos, setTodos] = useState(() => {
    const arr = initialTodos.map((t) => ({ ...t }));
    if (!arr.length || arr[arr.length - 1].text.trim() !== "") arr.push(newTodo());
    return arr;
  });

  const inputs = useRef(new Map()); // id -> input element
  const focusId = useRef(null); // 下一次 render 要聚焦的行
  const saveTimer = useRef(null);

  // 進入清單時，自動聚焦最後一行空白，直接就能打字
  useEffect(() => {
    const last = todos[todos.length - 1];
    const elm = last && inputs.current.get(last.id);
    if (elm) elm.focus();
    // 僅在掛載時執行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 聚焦到 focusId 指定的行（新增 / 刪除後）
  useEffect(() => {
    if (!focusId.current) return;
    const elm = inputs.current.get(focusId.current);
    if (elm) {
      elm.focus();
      const len = elm.value.length;
      elm.setSelectionRange(len, len);
    }
    focusId.current = null;
  });

  const persist = useCallback(
    (list) => {
      const payload = list
        .filter((t) => t.text.trim() !== "")
        .map((t) => ({
          id: t.id,
          text: t.text.trim(),
          done: t.done,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        }));
      saveTodosAction(listId, payload);
    },
    [listId]
  );

  const scheduleSave = useCallback(
    (list) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(list), 500);
    },
    [persist]
  );

  function commit(next) {
    setTodos(next);
    scheduleSave(next);
  }

  function flushNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist(todos);
  }

  /* ---------- 互動 ---------- */

  function onText(id, value) {
    commit(todos.map((t) => (t.id === id ? { ...t, text: value } : t)));
  }

  function onKeyDown(e, id, index) {
    if (e.key === "Enter") {
      e.preventDefault();
      const nt = newTodo();
      const next = [...todos];
      next.splice(index + 1, 0, nt);
      focusId.current = nt.id;
      commit(next);
    } else if (e.key === "Backspace" && todos[index].text === "" && todos.length > 1) {
      e.preventDefault();
      const prev = todos[index - 1];
      const next = todos.filter((t) => t.id !== id);
      if (prev) focusId.current = prev.id;
      commit(next);
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      focusId.current = todos[index - 1].id;
      setTodos([...todos]); // 觸發聚焦 effect
    } else if (e.key === "ArrowDown" && index < todos.length - 1) {
      e.preventDefault();
      focusId.current = todos[index + 1].id;
      setTodos([...todos]);
    }
  }

  function toggle(id) {
    commit(
      todos.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
              completedAt: !t.done ? new Date().toISOString() : null,
            }
          : t
      )
    );
  }

  function removeRow(id) {
    const next = todos.filter((t) => t.id !== id);
    if (!next.length) next.push(newTodo());
    commit(next);
  }

  /* ---------- 渲染（相鄰日期不同就插入分隔線） ---------- */

  const rows = [];
  let lastDay = null;
  todos.forEach((t, index) => {
    const dk = dayKey(t.createdAt);
    if (dk !== lastDay) {
      rows.push(
        <div className="day-sep" key={`sep-${dk}-${index}`}>
          <span>{formatDayLabel(dk)}</span>
        </div>
      );
      lastDay = dk;
    }
    const empty = t.text.trim() === "";
    rows.push(
      <div className={`todo${t.done ? " done" : ""}`} key={t.id}>
        <button
          type="button"
          className={`check${t.done ? " checked" : ""}`}
          role="checkbox"
          aria-checked={t.done}
          tabIndex={-1}
          onClick={() => toggle(t.id)}
        />
        <input
          ref={(elm) => {
            if (elm) inputs.current.set(t.id, elm);
            else inputs.current.delete(t.id);
          }}
          className="todo-input"
          value={t.text}
          placeholder={empty ? "輸入待辦，按 Enter 新增下一行…" : ""}
          onChange={(e) => onText(t.id, e.target.value)}
          onKeyDown={(e) => onKeyDown(e, t.id, index)}
          onBlur={flushNow}
        />
        {!empty && <span className="todo-time">{formatTime(t.createdAt)}</span>}
        {!empty && (
          <button
            type="button"
            className="todo-del"
            tabIndex={-1}
            title="刪除"
            onClick={() => removeRow(t.id)}
          >
            ✕
          </button>
        )}
      </div>
    );
  });

  return <div className="editor">{rows}</div>;
}
