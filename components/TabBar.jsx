"use client";

import Link from "next/link";
import { useState, useTransition, useRef, useEffect } from "react";
import {
  createListAction,
  updateListAction,
  deleteListAction,
} from "../app/actions.js";
import { COLORS, textColorFor } from "../lib/colors.js";

export default function TabBar({ lists, activeId }) {
  const [editing, setEditing] = useState(null); // 正在設定的清單
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [pending, start] = useTransition();
  const pressedOnOverlay = useRef(false); // 記錄按下的起點，避免拖曳到外面才放開時誤關
  const navRef = useRef(null);
  const activeRef = useRef(null);
  const restoreFocus = useRef(null);

  // 讓選中的分頁（含剛建立、被導向的新清單）自動捲到可見範圍
  useEffect(() => {
    const el = activeRef.current;
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeId]);

  // 彈窗開啟時：鎖背景捲動、支援 Esc 關閉、關閉後還原焦點
  useEffect(() => {
    if (!editing) return;
    restoreFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      if (restoreFocus.current && restoreFocus.current.focus) restoreFocus.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function openSettings(list) {
    setEditing(list);
    setName(list.name);
    setColor(list.color);
  }
  function close() {
    setEditing(null);
  }
  function save() {
    const id = editing.id;
    const n = name;
    const c = color;
    close();
    start(() => updateListAction(id, n, c));
  }
  function remove() {
    if (!confirm(`確定刪除清單「${editing.name}」？此清單內的待辦會一併刪除。`))
      return;
    const id = editing.id;
    close();
    start(() => deleteListAction(id));
  }

  return (
    <>
      <nav className="tabbar" ref={navRef}>
        {/* 主頁分頁 */}
        <Link
          href="/"
          ref={activeId === "home" ? activeRef : null}
          className={`tab${activeId === "home" ? " active" : ""}`}
          style={{ background: "#3a3a44" }}
        >
          🏠 主頁
        </Link>

        {/* 各清單分頁：整塊長方形、顏色即背景、彼此相黏 */}
        {lists.map((list) => {
          const active = list.id === activeId;
          const fg = active ? textColorFor(list.color) : "#fff";
          const inner = (
            <>
              <span className="tab-label">{list.name}</span>
              {list.openCount > 0 && <span className="count">{list.openCount}</span>}
              {active && (
                <span className="tab-gear" aria-hidden="true">
                  ⚙
                </span>
              )}
            </>
          );
          return active ? (
            <button
              key={list.id}
              ref={activeRef}
              type="button"
              className="tab active"
              style={{ background: list.color, color: fg }}
              onClick={() => openSettings(list)}
              aria-label={`${list.name}（點擊設定：改名 / 顏色 / 刪除）`}
              title="點擊設定（改名 / 顏色 / 刪除）"
            >
              {inner}
            </button>
          ) : (
            <Link
              key={list.id}
              href={`/list/${encodeURIComponent(list.id)}`}
              className="tab"
              style={{ background: list.color, color: fg }}
            >
              {inner}
            </Link>
          );
        })}

        {/* 新增清單 */}
        <form action={createListAction}>
          <button type="submit" className="tab-add" title="新增清單" aria-label="新增清單">
            ＋
          </button>
        </form>
      </nav>

      {/* 設定彈窗 */}
      {editing && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            pressedOnOverlay.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            // 僅在「按下與放開都在遮罩上」時才關閉（單純點外面）
            if (e.target === e.currentTarget && pressedOnOverlay.current) close();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <h2 id="modal-title">清單設定</h2>

            <label className="field">
              <span>名稱</span>
              <input
                value={name}
                maxLength={40}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </label>

            <div className="field">
              <span>顏色</span>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${c === color ? " selected" : ""}`}
                    style={{ background: c, color: c }}
                    onClick={() => setColor(c)}
                    aria-label={`選擇顏色 ${c}`}
                    aria-pressed={c === color}
                  />
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-danger" onClick={remove} disabled={pending}>
                刪除清單
              </button>
              <span className="spacer" />
              <button type="button" className="btn-ghost" onClick={close}>
                取消
              </button>
              <button type="button" className="btn-primary" onClick={save} disabled={pending}>
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
