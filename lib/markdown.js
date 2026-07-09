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
 * 待辦本體就是標準 GitHub task list，時間等中繼資料放在檔尾的 HTML 註解裡，
 * 因此檔案本身仍是乾淨、可讀、可手動編輯的 Markdown。
 *
 * 陣列順序（由上而下）就是清單順序 —— 不再依 createdAt 重排，插入的位置會被保留。
 * ========================================================================= */

import { randomUUID } from "crypto";

// frontmatter 的值與待辦文字都不允許換行（單行 Markdown），一律壓成空白避免壞檔
function oneLine(v) {
  return String(v ?? "").replace(/[\r\n]+/g, " ");
}

// 將清單物件序列化為 Markdown 字串（保留 list.todos 的陣列順序）
export function serializeList(list) {
  const lines = [];
  lines.push("---");
  lines.push(`name: ${oneLine(list.name).trim()}`);
  lines.push(`color: ${oneLine(list.color).trim()}`);
  lines.push("---");
  lines.push("");

  for (const t of list.todos) {
    const box = t.done ? "[x]" : "[ ]";
    const meta = [`id:${t.id}`, `created:${t.createdAt}`];
    if (t.done && t.completedAt) meta.push(`done:${t.completedAt}`);
    // 我方的中繼註解永遠寫在最後；即使使用者文字本身含有 <!-- / -->，
    // 解析時只會剝掉最後那段以 id: 開頭的註解，文字得以完整保留。
    lines.push(`- ${box} ${oneLine(t.text)} <!-- ${meta.join(" ")} -->`);
  }
  lines.push("");
  return lines.join("\n");
}

// 只擷取 task-list 那一行的「勾選狀態 + 其餘內容」
const CHECK_RE = /^\s*- \[([ xX])\]\s+(.*)$/;
// 從其餘內容尾端剝掉「以 id: 開頭」的中繼註解。
// 前綴用「貪婪」的 (.*) —— 因為我方註解永遠寫在最後，貪婪比對會保留使用者文字中
// 任何較早出現的 <!-- ... -->，只剝掉最後那一段真正的中繼資料。
const META_RE = /^(.*)\s*<!--\s*(id:.*?)\s*-->\s*$/;

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
  for (const raw of body.split("\n")) {
    const m = raw.match(CHECK_RE);
    if (!m) continue;
    const done = m[1].toLowerCase() === "x";

    let text = m[2];
    let metaStr = "";
    const mm = text.match(META_RE);
    if (mm) {
      text = mm[1];
      metaStr = mm[2];
    }
    text = text.replace(/\s+$/, "");

    const meta = {};
    for (const pair of metaStr.split(/\s+/)) {
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

// 這個檔案在解析時是否需要「正規化並回寫」（缺少 id / created 中繼資料，
// 例如手動編輯過的檔案）—— 若不回寫，每次讀取都會重配新 id，導致首頁勾選失效。
export function needsNormalize(content, list) {
  if (!list.todos.length) return false;
  const idCount = (content.match(/<!--\s*id:/g) || []).length;
  const createdCount = (content.match(/\bcreated:/g) || []).length;
  return idCount < list.todos.length || createdCount < list.todos.length;
}
