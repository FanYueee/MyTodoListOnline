/* =========================================================================
 * 日期 / 時間格式化與分組（純函式，前後端皆可用）
 * ========================================================================= */

function pad(n) {
  return String(n).padStart(2, "0");
}

// 取得某時間的「當地日期」key：YYYY-MM-DD
export function dayKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 日期分隔線文字：今天 / 昨天 / YYYY年M月D日 週X
export function formatDayLabel(key) {
  const now = new Date();
  const todayK = dayKey(now);
  const yK = dayKey(new Date(now.getTime() - 86400000));
  if (key === todayK) return "今天";
  if (key === yK) return "昨天";
  const [y, m, d] = key.split("-").map(Number);
  const wd = "日一二三四五六"[new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日 週${wd}`;
}

// 每筆待辦尾端的小字時間：HH:MM
export function formatTime(input) {
  const d = new Date(input);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 將 entries（含 .todo.createdAt）依日期分組，組間與組內皆新→舊
export function groupByDay(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = dayKey(e.todo.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.keys()]
    .sort()
    .reverse()
    .map((key) => ({
      key,
      items: map
        .get(key)
        .sort((a, b) => new Date(b.todo.createdAt) - new Date(a.todo.createdAt)),
    }));
}
