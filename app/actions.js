"use server";

/* =========================================================================
 * Server Actions — 由 client 元件呼叫。
 * 待辦改為「逐項（id 定址）」操作，每個操作都回傳整份最新快照，讓前端可即時
 * 收斂到伺服器狀態（多分頁自動同步）。
 * ========================================================================= */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as store from "../lib/store.js";

// 只讓「首頁彙整」重新整理。清單頁本身用回傳快照就地更新，不需整頁重驗證，
// 避免每次按鍵都觸發全站重繪。
function refreshHome() {
  revalidatePath("/");
}

/* ----------------------------- 待辦（逐項） ----------------------------- */

export async function insertTodoAction(listId, todo, afterId) {
  const todos = await store.insertTodo(listId, todo, afterId || null);
  refreshHome();
  return todos;
}

export async function setTodoTextAction(listId, todoId, text) {
  const todos = await store.setTodoText(listId, todoId, text);
  // 純改字不影響首頁「未完成」的組成，交由首頁自身輪詢/導覽時刷新即可
  return todos;
}

export async function toggleTodoAction(listId, todoId, done) {
  const todos = await store.toggleTodo(listId, todoId, done);
  refreshHome();
  return todos;
}

export async function deleteTodoAction(listId, todoId) {
  const todos = await store.deleteTodo(listId, todoId);
  refreshHome();
  return todos;
}

// 供編輯器 / 首頁輪詢用的唯讀動作
export async function getTodosAction(listId) {
  return store.getTodoSnapshot(listId);
}

/* ----------------------------- 清單 ----------------------------- */

export async function createListAction() {
  const id = await store.createList();
  revalidatePath("/", "layout");
  redirect(`/list/${encodeURIComponent(id)}`);
}

export async function updateListAction(listId, name, color) {
  await store.updateList(listId, name, color);
  revalidatePath("/", "layout");
}

export async function deleteListAction(listId) {
  await store.deleteList(listId);
  revalidatePath("/", "layout");
  redirect("/");
}
