/* =========================================================================
 * 檔案儲存層 — 直接讀寫 data/ 資料夾裡的 Markdown 檔
 * 每個檔案就是一個清單，檔名（去掉 .md）即清單 id。僅在伺服器端執行。
 *
 * 併發安全設計：
 *   - 每個檔案（含建立清單用的 __global__）都有一條「非同步互斥鎖」串接所有
 *     讀→改→寫，避免兩個請求交錯造成 lost update。
 *   - 寫入採「暫存檔 + rename」原子寫入，避免同時讀到寫到一半的檔案。
 *   - 待辦以逐項（id 定址）方式操作，兩個分頁改不同項目不會互相覆蓋；每個
 *     操作都回傳整份最新快照，讓前端可即時收斂。
 * ========================================================================= */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { serializeList, parseList, needsNormalize } from "./markdown.js";
import { COLORS } from "./colors.js";

const DATA_DIR = path.join(process.cwd(), "data");

export { COLORS };

const nowISO = () => new Date().toISOString();
const oneLine = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();

/* ----------------------------- 每檔非同步互斥鎖 ----------------------------- */

const locks = new Map(); // id -> Promise 鏈尾

function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const result = prev.then(() => fn());
  // 無論 fn 成功或失敗，鏈都要延續下去（吞掉錯誤只為維持鏈，錯誤仍會回傳給呼叫者）
  locks.set(
    id,
    result.then(
      () => {},
      () => {}
    )
  );
  return result;
}

/* ----------------------------- 基礎 IO ----------------------------- */

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(id) {
  return path.join(DATA_DIR, `${id}.md`);
}

// 讀取並解析（不正規化、不上鎖）—— 內部操作在鎖內使用
async function readRaw(id) {
  try {
    const content = await fs.readFile(filePath(id), "utf8");
    return parseList(content, id);
  } catch {
    return null;
  }
}

// 原子寫入：先寫暫存檔再 rename（同一檔案系統上 rename 為原子操作）
async function writeList(list) {
  await ensureDir();
  const target = filePath(list.id);
  const tmp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, serializeList(list), "utf8");
  await fs.rename(tmp, target);
}

// 讀取；若檔案缺少 id/created 中繼資料（例如手動編輯過），正規化並回寫一次，
// 讓 id/時間從此穩定，避免每次讀取都重配 id 造成勾選/刪除失效。
async function getListNormalized(id) {
  await ensureDir();
  let content;
  try {
    content = await fs.readFile(filePath(id), "utf8");
  } catch {
    return null;
  }
  const list = parseList(content, id);
  if (needsNormalize(content, list)) {
    return withLock(id, async () => {
      // 進鎖後重讀，避免與其他寫入競爭
      let fresh;
      try {
        fresh = await fs.readFile(filePath(id), "utf8");
      } catch {
        return null;
      }
      const freshList = parseList(fresh, id);
      if (needsNormalize(fresh, freshList)) await writeList(freshList);
      return freshList;
    });
  }
  return list;
}

/* ----------------------------- 讀取 ----------------------------- */

export async function getAllLists() {
  await ensureDir();
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".md"));
  const lists = [];
  for (const f of files) {
    const list = await getListNormalized(f.slice(0, -3));
    if (list) lists.push(list);
  }
  lists.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return lists;
}

export async function getList(id) {
  return getListNormalized(id);
}

// 供前端輪詢：只回傳待辦快照（已正規化、id 穩定）
export async function getTodoSnapshot(id) {
  const list = await getListNormalized(id);
  return list ? list.todos : null;
}

/* ----------------------------- 檔名工具 ----------------------------- */

// 從名稱產生安全、唯一的檔名（保留中文）
function slugify(name) {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|.]/g, "") // 移除檔名不允許的字元
      .replace(/\s+/g, "-") || "list"
  );
}

async function existingIds() {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  return new Set(files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
}

async function uniqueId(base, ids) {
  let id = base;
  let n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;
  return id;
}

/* ----------------------------- 清單操作 ----------------------------- */

export async function createList() {
  // 建立清單牽涉「掃描現有檔名以取唯一名稱」，用全域鎖串接避免兩個同時建立撞名
  return withLock("__global__", async () => {
    const ids = await existingIds();

    // 預設名稱：清單 1、清單 2 …
    let n = 1;
    let name;
    do {
      name = `清單 ${n++}`;
    } while (ids.has(slugify(name)));

    // 挑一個還沒用到的顏色
    const lists = await getAllLists();
    const used = new Set(lists.map((l) => l.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[lists.length % COLORS.length];

    const id = await uniqueId(slugify(name), ids);
    await writeList({ id, name, color, todos: [] });
    return id;
  });
}

export async function updateList(id, name, color) {
  return withLock(id, async () => {
    const list = await readRaw(id);
    if (!list) return;
    if (name && oneLine(name)) list.name = oneLine(name);
    if (color) list.color = oneLine(color);
    await writeList(list);
  });
}

export async function deleteList(id) {
  return withLock(id, async () => {
    try {
      await fs.unlink(filePath(id));
    } catch {
      /* 已不存在則略過 */
    }
  });
}

/* ----------------------------- 待辦操作（逐項、id 定址） ----------------------------- */

// 依 afterId 之後插入一筆新待辦；afterId 不存在（或為空）則接在最後。
// 若 id 已存在則視為冪等更新其文字（例如重試）。回傳最新快照。
export async function insertTodo(id, todo, afterId) {
  return withLock(id, async () => {
    const list = await readRaw(id);
    if (!list) return null;
    const text = oneLine(todo && todo.text);
    if (!text) return list.todos; // 空文字不建立

    const existing = list.todos.find((t) => t.id === todo.id);
    if (existing) {
      existing.text = text;
    } else {
      const clean = {
        id: todo.id || randomUUID(),
        text,
        done: !!(todo && todo.done),
        createdAt: (todo && todo.createdAt) || nowISO(),
        completedAt: todo && todo.done ? (todo.completedAt || nowISO()) : null,
      };
      const idx = afterId ? list.todos.findIndex((t) => t.id === afterId) : -1;
      if (idx === -1) list.todos.push(clean);
      else list.todos.splice(idx + 1, 0, clean);
    }
    await writeList(list);
    return list.todos;
  });
}

// 設定某待辦文字；文字清空則刪除該待辦；找不到（已被別分頁刪除）則忽略。
export async function setTodoText(id, todoId, text) {
  return withLock(id, async () => {
    const list = await readRaw(id);
    if (!list) return null;
    const t = list.todos.find((x) => x.id === todoId);
    if (!t) return list.todos;
    const clean = oneLine(text);
    if (!clean) list.todos = list.todos.filter((x) => x.id !== todoId);
    else t.text = clean;
    await writeList(list);
    return list.todos;
  });
}

// 設定完成狀態（傳明確的 done 值，冪等；未傳則切換）。
export async function toggleTodo(id, todoId, done) {
  return withLock(id, async () => {
    const list = await readRaw(id);
    if (!list) return null;
    const t = list.todos.find((x) => x.id === todoId);
    if (!t) return list.todos;
    const next = typeof done === "boolean" ? done : !t.done;
    t.done = next;
    t.completedAt = next ? t.completedAt || nowISO() : null;
    await writeList(list);
    return list.todos;
  });
}

export async function deleteTodo(id, todoId) {
  return withLock(id, async () => {
    const list = await readRaw(id);
    if (!list) return null;
    list.todos = list.todos.filter((x) => x.id !== todoId);
    await writeList(list);
    return list.todos;
  });
}
