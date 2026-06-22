"use server";

/* =========================================================================
 * Server Actions — 由 client 元件呼叫，負責改檔並讓畫面重新整理
 * ========================================================================= */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as store from "../lib/store.js";

// 任一變更後重新驗證整個 app（主頁與各清單頁都會更新）
function refresh() {
  revalidatePath("/", "layout");
}

/* ----------------------------- 待辦 ----------------------------- */

export async function addTodoAction(listId, text) {
  if (text && text.trim()) await store.addTodo(listId, text);
  refresh();
}

export async function toggleTodoAction(listId, todoId) {
  await store.toggleTodo(listId, todoId);
  refresh();
}

export async function deleteTodoAction(listId, todoId) {
  await store.deleteTodo(listId, todoId);
  refresh();
}

// 編輯器整批儲存（含新增 / 改字 / 勾選 / 刪除）
export async function saveTodosAction(listId, todos) {
  await store.setTodos(listId, todos);
  refresh();
}

/* ----------------------------- 清單 ----------------------------- */

export async function createListAction() {
  const id = await store.createList();
  refresh();
  redirect(`/list/${encodeURIComponent(id)}`);
}

export async function updateListAction(listId, name, color) {
  await store.updateList(listId, name, color);
  refresh();
}

export async function deleteListAction(listId) {
  await store.deleteList(listId);
  refresh();
  redirect("/");
}
