"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 以 SSE 接收「有人已寫入資料」的通知。實際待辦內容仍由各畫面的既有
// Server Action 讀取，避免把資料與 UI 同步邏輯耦合在一起。
export default function LiveSync({ listId }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const change = JSON.parse(event.data);
        if (change.type === "ready") {
          // 新分頁載入到 SSE 建立之間可能剛好漏掉一則更新；連上後主動拉一次
          // 快照，確保不會停在過期的 SSR 資料。
          document.documentElement.dataset.realtime = "connected";
          window.dispatchEvent(
            new CustomEvent("todos:changed", { detail: { type: "ready", listId } })
          );
          if (!listId) router.refresh();
          return;
        }
        window.dispatchEvent(new CustomEvent("todos:changed", { detail: change }));
        // 清單頁的待辦交由 Editor 合併快照；在這裡整頁 refresh 會和連續
        // 勾選競爭。首頁沒有 Editor，仍需立刻重新取得彙整資料。
        if (!listId || change.type === "lists") router.refresh();
      } catch {
        // EventSource 會自動重新連線；單一壞訊息不影響編輯器。
      }
    };
    return () => source.close();
  }, [router, listId]);

  return null;
}
