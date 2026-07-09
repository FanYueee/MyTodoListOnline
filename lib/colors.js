/* =========================================================================
 * 清單顏色（前後端共用，純資料、無副作用，client 也可安全 import）
 * ========================================================================= */

export const COLORS = [
  "#4f8cff", "#4caf7d", "#ff9f43", "#ff5a5a",
  "#a36bff", "#ff6fb5", "#2dd4bf", "#d4b106",
];

// 依背景亮度決定前景文字色：淺色底（黃、青、橘、粉）用深字，深色底用白字，
// 確保選中分頁的文字在任何色票上都清晰可讀。
export function textColorFor(bg) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(bg || "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#17171b" : "#ffffff";
}
