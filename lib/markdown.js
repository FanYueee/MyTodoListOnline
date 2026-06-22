/* =========================================================================
 * Markdown 序列化 / 解析
 *
 * 每個清單就是一個 .md 檔，格式為：
 *
 *   ---
 *   name: 我的清單
 *   color: #4f8cff
 *   ---
 *
 *   - [ ] 買牛奶 <!-- id:xxx created:2026-06-22T10:30:00 -->
 *   - [x] 寫程式 <!-- id:xxx created:2026-06-22T09:00 done:2026-06-22T11:00 -->
 *
 * 待辦本體就是標準 GitHub task list，時間等中繼資料放在 HTML 註解裡，
 * 因此檔案本身仍是乾淨、可讀、可手動編輯的 Markdown。
 * ========================================================================= */

import { randomUUID } from "crypto";

// 將清單物件序列化為 Markdown 字串
export function serializeList(list) {
  const lines = [];
  lines.push("---");
  lines.push(`name: ${list.name}`);
  lines.push(`color: ${list.color}`);
  lines.push("---");
  lines.push("");

  // 依建立時間舊→新寫入，讓 Markdown 檔由上而下就是時間順序
  const sorted = [...list.todos].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  for (const t of sorted) {
    const box = t.done ? "[x]" : "[ ]";
    const meta = [`id:${t.id}`, `created:${t.createdAt}`];
    if (t.done && t.completedAt) meta.push(`done:${t.completedAt}`);
    lines.push(`- ${box} ${t.text} <!-- ${meta.join(" ")} -->`);
  }
  lines.push("");
  return lines.join("\n");
}

// 將 Markdown 字串解析為清單物件；id 來自檔名
export function parseList(content, id) {
  let name = id;
  let color = "#4f8cff";
  let body = content;

  // 解析 frontmatter
  const fm = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = content.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      const i = line.indexOf(":");
      if (i === -1) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k === "name") name = v;
      else if (k === "color") color = v;
    }
  }

  // 解析 task list 項目
  const todos = [];
  const re = /^\s*- \[([ xX])\]\s+(.*?)(?:\s*<!--\s*(.*?)\s*-->)?\s*$/;
  for (const raw of body.split("\n")) {
    const m = raw.match(re);
    if (!m) continue;
    const done = m[1].toLowerCase() === "x";
    const text = m[2];
    const meta = {};
    for (const pair of (m[3] || "").split(/\s+/)) {
      const j = pair.indexOf(":");
      if (j > 0) meta[pair.slice(0, j)] = pair.slice(j + 1);
    }
    todos.push({
      id: meta.id || randomUUID(),
      text,
      done,
      createdAt: meta.created || new Date().toISOString(),
      completedAt: meta.done || (done ? meta.created || null : null),
    });
  }

  return { id, name, color, todos };
}
