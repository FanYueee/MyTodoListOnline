"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  insertTodoAction,
  setTodoTextAction,
  toggleTodoAction,
  deleteTodoAction,
  getTodosAction,
} from "../app/actions.js";
import { formatTime, formatDayLabel, dayKey } from "../lib/format.js";
import { mergeTodos } from "../lib/mergeTodos.js";

const POLL_MS = 4000; // 多分頁自動同步的輪詢間隔
const SAVE_DEBOUNCE = 500;
const EMPTY_ID = "__new__"; // 首列尾端空白列的固定 id（避免 SSR/hydration 不一致）

// 本地 id（不依賴 crypto.randomUUID，於非 https 的區網 IP 也可用）
function genId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function emptyRow(id = genId()) {
  return { id, text: "", done: false, createdAt: null, completedAt: null, persisted: false };
}
function fromServer(t) {
  return {
    id: t.id,
    text: t.text,
    done: !!t.done,
    createdAt: t.createdAt,
    completedAt: t.completedAt ?? null,
    persisted: true,
  };
}
// 一列是否為「真正的待辦」（有文字或已存檔）—— 空白尾列不算，不顯示勾選框 / 時間 / 刪除
function isReal(row) {
  return row.persisted || row.text.trim() !== "";
}

export default function Editor({ listId, initialTodos }) {
  const [todos, setTodos] = useState(() => {
    const arr = initialTodos.map(fromServer);
    arr.push(emptyRow(EMPTY_ID));
    return arr;
  });
  const [mounted, setMounted] = useState(false); // 時間/日期分隔線只在掛載後渲染（避免時區 hydration 不一致）
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [collapsed, setCollapsed] = useState(true); // 已完成區塊預設自動收合

  const inputs = useRef(new Map()); // id -> input element
  const focusId = useRef(null); // 下一次 render 要聚焦的行
  const focusedId = useRef(null); // 目前聚焦中的行（合併同步時需保護）
  const dirty = useRef(new Set()); // 有未存變更的行 id（合併同步時需保護）
  const saveTimer = useRef(null);
  const chain = useRef(Promise.resolve()); // 串接所有 server 呼叫，維持先後順序
  const pending = useRef(0); // 進行中的存檔數
  const latest = useRef(todos); // 最新 todos（供計時器 / 卸載時使用，避免 stale closure）
  const isMounted = useRef(true);
  latest.current = todos;

  /* ---------- 掛載 / 卸載 ---------- */

  useEffect(() => {
    setMounted(true);
    // 進入清單時，自動聚焦最後一行空白，直接就能打字
    const last = latest.current[latest.current.length - 1];
    const elm = last && inputs.current.get(last.id);
    if (elm) elm.focus();
    return () => {
      isMounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // 卸載前把未存的變更補送出去（不更新畫面），確保最後編輯不遺失
      flushDirty(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 聚焦到 focusId 指定的行（新增 / 刪除 / 方向鍵後）
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

  /* ---------- 與伺服器合併（多分頁自動同步） ---------- */

  const applyServer = useCallback((serverTodos) => {
    if (!isMounted.current || !serverTodos) return;
    const protectedIds = new Set(dirty.current);
    if (focusedId.current) protectedIds.add(focusedId.current);
    setTodos((cur) => mergeTodos(cur, serverTodos, protectedIds, () => emptyRow()));
  }, []);

  // 把「解析待辦操作 → 呼叫對應 server action」的邏輯集中在此
  const resolveSave = useCallback(
    (rowId) => {
      const list = latest.current;
      const row = list.find((r) => r.id === rowId);
      if (!row) return null;
      const text = row.text.trim();
      if (!row.persisted) {
        if (!text) return null; // 還是空的，不需存
        // 新列：在前一個已存檔的列之後插入
        let afterId = null;
        const idx = list.findIndex((r) => r.id === rowId);
        for (let i = idx - 1; i >= 0; i--) {
          if (list[i].persisted) {
            afterId = list[i].id;
            break;
          }
        }
        return insertTodoAction(listId, { id: row.id, text, done: row.done, createdAt: row.createdAt || new Date().toISOString() }, afterId);
      }
      if (!text) return deleteTodoAction(listId, rowId); // 清空文字＝刪除
      return setTodoTextAction(listId, rowId, text);
    },
    [listId]
  );

  // 把一個 server 呼叫排入序列，並更新存檔狀態 + 合併回傳快照
  const enqueue = useCallback(
    (thunk) => {
      const p = chain.current.then(thunk);
      chain.current = p.then(
        () => {},
        () => {}
      );
      pending.current += 1;
      setStatus("saving");
      p.then(
        (snapshot) => {
          pending.current -= 1;
          applyServer(snapshot);
          if (pending.current === 0 && isMounted.current) {
            setStatus("saved");
            setTimeout(() => {
              if (isMounted.current && pending.current === 0) setStatus("idle");
            }, 1500);
          }
        },
        () => {
          pending.current -= 1;
          if (isMounted.current) setStatus("error");
        }
      );
      return p;
    },
    [applyServer]
  );

  // 送出所有 dirty 行。fireOnly=true 時（卸載）只送出、不排入狀態更新。
  const flushDirty = useCallback(
    (fireOnly = false) => {
      const ids = [...dirty.current];
      dirty.current.clear();
      for (const id of ids) {
        // 不在此標記 persisted：store 的插入以 id 冪等，重複送出只會更新文字，不會重覆新增。
        if (fireOnly) {
          const pr = resolveSave(id);
          if (pr) pr.catch(() => {});
        } else {
          enqueue(() => resolveSave(id) || Promise.resolve(null));
        }
      }
    },
    [enqueue, resolveSave]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushDirty(false), SAVE_DEBOUNCE);
  }, [flushDirty]);

  /* ---------- 輪詢（分頁可見時，把其他分頁的變更抓進來） ---------- */

  useEffect(() => {
    let timer = null;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      if (pending.current > 0) return; // 有存檔進行中，等它回傳快照即可
      try {
        const snap = await getTodosAction(listId);
        applyServer(snap);
      } catch {
        /* 忽略單次輪詢失敗 */
      }
    };
    timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", poll);
    };
  }, [listId, applyServer]);

  /* ---------- 互動 ---------- */

  function onText(id, value) {
    setTodos((cur) => {
      const next = cur.map((t) => (t.id === id ? { ...t, text: value } : t));
      // 若在尾端空白列輸入了字，補一列新的空白尾列
      const last = next[next.length - 1];
      if (last.text.trim() !== "") next.push(emptyRow());
      return next;
    });
    dirty.current.add(id);
    scheduleSave();
  }

  function onKeyDown(e, id) {
    const row = todos.find((t) => t.id === id);
    if (!row || row.done) return; // 已完成列不參與新增/導覽快捷鍵

    // 鍵盤導覽只在「未完成」的可編輯流程內進行（跳過已完成列）
    const active = todos.filter((t) => !t.done);
    const ai = active.findIndex((t) => t.id === id);

    if (e.key === "Enter") {
      e.preventDefault();
      const nt = emptyRow();
      focusId.current = nt.id;
      setTodos((cur) => {
        const next = [...cur];
        const fi = next.findIndex((t) => t.id === id);
        next.splice(fi + 1, 0, nt);
        return next;
      });
    } else if (e.key === "Backspace" && row.text === "" && ai > 0) {
      // 只刪「非尾端」的空白列，尾端空白列永遠保留
      if (ai === active.length - 1) return;
      e.preventDefault();
      const prev = active[ai - 1];
      if (prev) focusId.current = prev.id;
      dirty.current.delete(id);
      if (row.persisted) enqueue(() => deleteTodoAction(listId, id));
      setTodos((cur) => cur.filter((t) => t.id !== id));
    } else if (e.key === "ArrowUp" && ai > 0) {
      e.preventDefault();
      focusId.current = active[ai - 1].id;
      setTodos((cur) => [...cur]);
    } else if (e.key === "ArrowDown" && ai < active.length - 1) {
      e.preventDefault();
      focusId.current = active[ai + 1].id;
      setTodos((cur) => [...cur]);
    }
  }

  function toggle(id) {
    const cur = todos.find((t) => t.id === id);
    if (!cur) return;
    const nextDone = !cur.done;
    setTodos((list) =>
      list.map((t) =>
        t.id === id
          ? { ...t, done: nextDone, completedAt: nextDone ? new Date().toISOString() : null }
          : t
      )
    );
    dirty.current.add(id);
    // 勾選是明確動作，立即送出（帶明確的 done 值）
    enqueue(() => {
      dirty.current.delete(id);
      return toggleTodoAction(listId, id, nextDone);
    });
  }

  function removeRow(id) {
    const row = todos.find((t) => t.id === id);
    dirty.current.delete(id);
    if (row && row.persisted) enqueue(() => deleteTodoAction(listId, id));
    setTodos((cur) => {
      const next = cur.filter((t) => t.id !== id);
      const last = next[next.length - 1];
      if (!last || last.text.trim() !== "") next.push(emptyRow());
      return next;
    });
  }

  function onFocus(id) {
    focusedId.current = id;
  }
  function onBlur() {
    focusedId.current = null;
    // 離開欄位時立即存檔（不必等 debounce）
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushDirty(false);
  }

  /* ---------- 已完成收合（本機記憶，每個清單各自記住） ---------- */

  useEffect(() => {
    try {
      const v = localStorage.getItem(`todo-done-collapsed:${listId}`);
      if (v !== null) setCollapsed(v === "1");
    } catch {
      /* localStorage 不可用時就用預設收合 */
    }
  }, [listId]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(`todo-done-collapsed:${listId}`, next ? "1" : "0");
      } catch {
        /* 忽略 */
      }
      return next;
    });
  }

  /* ---------- 渲染 ---------- */

  const renderRow = (t) => {
    const real = isReal(t);
    const empty = t.text.trim() === "";
    return (
      <div className={`todo${t.done ? " done" : ""}`} key={t.id}>
        {real ? (
          <button
            type="button"
            className={`check${t.done ? " checked" : ""}`}
            role="checkbox"
            aria-checked={t.done}
            aria-label={t.done ? "標記為未完成" : "標記為完成"}
            onClick={() => toggle(t.id)}
          />
        ) : (
          <span className="check-placeholder" aria-hidden="true" />
        )}
        <input
          ref={(elm) => {
            if (elm) inputs.current.set(t.id, elm);
            else inputs.current.delete(t.id);
          }}
          className="todo-input"
          value={t.text}
          aria-label="待辦內容"
          placeholder={empty ? "輸入待辦，按 Enter 新增下一行…" : ""}
          onChange={(e) => onText(t.id, e.target.value)}
          onKeyDown={(e) => onKeyDown(e, t.id)}
          onFocus={() => onFocus(t.id)}
          onBlur={onBlur}
        />
        {mounted && real && t.createdAt && (
          <span className="todo-time">{formatTime(t.createdAt)}</span>
        )}
        {real && (
          <button
            type="button"
            className="todo-del"
            title="刪除"
            aria-label="刪除這筆待辦"
            onClick={() => removeRow(t.id)}
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // 未完成：依日期分隔線渲染（含尾端空白輸入列）
  const activeTodos = todos.filter((t) => !t.done);
  const activeNodes = [];
  let lastDay = null;
  activeTodos.forEach((t) => {
    if (mounted && isReal(t) && t.createdAt) {
      const dk = dayKey(t.createdAt);
      if (dk !== lastDay) {
        activeNodes.push(
          <div className="day-sep" key={`sep-${dk}`}>
            <span>{formatDayLabel(dk)}</span>
          </div>
        );
        lastDay = dk;
      }
    }
    activeNodes.push(renderRow(t));
  });

  // 已完成：收合到可展開區塊（最近完成的排前面）
  const doneTodos = todos
    .filter((t) => t.done)
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)
    );

  return (
    <div className="editor">
      <SaveStatus status={status} onRetry={() => flushDirty(false)} />
      {activeNodes}
      {doneTodos.length > 0 && (
        <div className="done-section">
          <button
            type="button"
            className="done-toggle"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
          >
            <span className={`chevron${collapsed ? "" : " open"}`} aria-hidden="true">
              ▸
            </span>
            <span>已完成</span>
            <span className="done-count">{doneTodos.length}</span>
          </button>
          {!collapsed && <div className="done-list">{doneTodos.map(renderRow)}</div>}
        </div>
      )}
    </div>
  );
}

function SaveStatus({ status, onRetry }) {
  if (status === "idle") return <div className="save-status" aria-hidden="true" />;
  if (status === "error") {
    return (
      <button type="button" className="save-status error" onClick={onRetry}>
        ⚠ 儲存失敗，點此重試
      </button>
    );
  }
  return (
    <div className={`save-status ${status}`} role="status" aria-live="polite">
      {status === "saving" ? "儲存中…" : "已儲存 ✓"}
    </div>
  );
}
