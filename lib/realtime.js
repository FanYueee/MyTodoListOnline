/* ========================================================================
 * 單一 Node 執行個體內的即時通知中心。
 * 資料仍由 store.js 寫入；這裡只負責通知已連線的瀏覽器重新取得最新快照。
 * 使用 globalThis 可避免 Next 開發模式熱更新時遺失既有 SSE 連線。
 * ====================================================================== */

const key = "__myTodoRealtimeListeners__";

function listeners() {
  if (!globalThis[key]) globalThis[key] = new Set();
  return globalThis[key];
}

export function subscribe(listener) {
  const set = listeners();
  set.add(listener);
  return () => set.delete(listener);
}

export function publish(change) {
  for (const listener of listeners()) {
    try {
      listener(change);
    } catch {
      // 個別連線已失效時不影響其他使用者的更新。
    }
  }
}
