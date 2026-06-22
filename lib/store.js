/* =========================================================================
 * 檔案儲存層 — 直接讀寫 data/ 資料夾裡的 Markdown 檔
 * 每個檔案就是一個清單，檔名（去掉 .md）即清單 id。
 * 僅在伺服器端執行。
 * ========================================================================= */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { serializeList, parseList } from "./markdown.js";

const DATA_DIR = path.join(process.cwd(), "data");

// 可選的資料夾顏色
export const COLORS = [
  "#4f8cff", "#4caf7d", "#ff9f43", "#ff5a5a",
  "#a36bff", "#ff6fb5", "#2dd4bf", "#d4b106",
];

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(id) {
  return path.join(DATA_DIR, `${id}.md`);
}

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

async function uniqueId(base) {
  const ids = await existingIds();
  let id = base;
  let n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;
  return id;
}

/* ----------------------------- 讀取 ----------------------------- */

export async function getAllLists() {
  await ensureDir();
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".md"));
  const lists = [];
  for (const f of files) {
    const id = f.slice(0, -3);
    const content = await fs.readFile(filePath(id), "utf8");
    lists.push(parseList(content, id));
  }
  lists.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return lists;
}

export async function getList(id) {
  await ensureDir();
  try {
    const content = await fs.readFile(filePath(id), "utf8");
    return parseList(content, id);
  } catch {
    return null;
  }
}

async function writeList(list) {
  await ensureDir();
  await fs.writeFile(filePath(list.id), serializeList(list), "utf8");
}

/* ----------------------------- 清單操作 ----------------------------- */

export async function createList() {
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

  const id = await uniqueId(slugify(name));
  await writeList({ id, name, color, todos: [] });
  return id;
}

export async function updateList(id, name, color) {
  const list = await getList(id);
  if (!list) return;
  if (name && name.trim()) list.name = name.trim();
  if (color) list.color = color;
  await writeList(list);
}

export async function deleteList(id) {
  try {
    await fs.unlink(filePath(id));
  } catch {
    /* 已不存在則略過 */
  }
}

/* ----------------------------- 待辦操作 ----------------------------- */

export async function addTodo(id, text) {
  const list = await getList(id);
  if (!list) return;
  list.todos.unshift({
    id: randomUUID(),
    text: text.trim(),
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
  await writeList(list);
}

export async function toggleTodo(id, todoId) {
  const list = await getList(id);
  if (!list) return;
  const t = list.todos.find((x) => x.id === todoId);
  if (!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? new Date().toISOString() : null;
  await writeList(list);
}

export async function deleteTodo(id, todoId) {
  const list = await getList(id);
  if (!list) return;
  list.todos = list.todos.filter((x) => x.id !== todoId);
  await writeList(list);
}

// 由編輯器整批覆寫待辦（會濾掉空白行）
export async function setTodos(id, todos) {
  const list = await getList(id);
  if (!list) return;
  list.todos = (todos || [])
    .map((t) => ({
      id: t.id,
      text: String(t.text || "").trim(),
      done: !!t.done,
      createdAt: t.createdAt || new Date().toISOString(),
      completedAt: t.done
        ? t.completedAt || new Date().toISOString()
        : null,
    }))
    .filter((t) => t.text !== "");
  await writeList(list);
}
