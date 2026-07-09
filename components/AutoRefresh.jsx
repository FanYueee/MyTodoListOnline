"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 首頁彙整用的輕量自動同步：分頁可見時，每隔 intervalMs 重新抓取伺服器資料，
// 讓其他分頁/裝置新增或勾選的待辦自動反映到首頁，不需手動重新整理。
export default function AutoRefresh({ intervalMs = 5000 }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);
  return null;
}
