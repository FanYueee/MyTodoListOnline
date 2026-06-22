"use client";

import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import {
  createListAction,
  updateListAction,
  deleteListAction,
} from "../app/actions.js";

// 與 lib/store.js 同步的可選顏色
const COLORS = [
  "#4f8cff", "#4caf7d", "#ff9f43", "#ff5a5a",
  "#a36bff", "#ff6fb5", "#2dd4bf", "#d4b106",
];

export default function TabBar({ lists, activeId }) {
  const [editing, setEditing] = useState(null); // 正在設定的清單
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [pending, start] = useTransition();
  const pressedOnOverlay = useRef(false); // 記錄按下的起點，避免拖曳到外面才放開時誤關

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
      <nav className="tabbar">
        {/* 主頁分頁 */}
        <Link
          href="/"
          className={`tab${activeId === "home" ? " active" : ""}`}
          style={{ background: "#444450" }}
        >
          🏠 主頁
        </Link>

        {/* 各清單分頁：整塊長方形、顏色即背景、彼此相黏 */}
        {lists.map((list) => {
          const active = list.id === activeId;
          return active ? (
            <button
              key={list.id}
              type="button"
              className="tab active"
              style={{ background: list.color }}
              onClick={() => openSettings(list)}
              title="點擊設定（改名 / 顏色 / 刪除）"
            >
              {list.name}
              {list.openCount > 0 && <span className="count">{list.openCount}</span>}
            </button>
          ) : (
            <Link
              key={list.id}
              href={`/list/${encodeURIComponent(list.id)}`}
              className="tab"
              style={{ background: list.color }}
            >
              {list.name}
              {list.openCount > 0 && <span className="count">{list.openCount}</span>}
            </Link>
          );
        })}

        {/* 新增清單 */}
        <form action={createListAction}>
          <button type="submit" className="tab-add" title="新增清單">
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
          <div className="modal">
            <h2>清單設定</h2>

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
