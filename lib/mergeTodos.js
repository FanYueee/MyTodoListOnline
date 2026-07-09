/* =========================================================================
 * 純函式：把「伺服器上的權威清單」合併進「編輯器本地清單」。
 *
 * 這是多分頁自動同步的核心。設計原則：
 *   1. 以伺服器順序為準（各分頁最終會收斂到相同順序）。
 *   2. 絕不覆蓋使用者正在編輯（focused）或尚未存檔（dirty）的那一列 —— 這些列
 *      的 id 放進 protectedIds，一律保留本地版本，避免打斷輸入或吃掉未存的字。
 *   3. 永遠在結尾保留「唯一一列空白列」可供輸入。
 *
 * 本檔不依賴 React / DOM / fs，因此可獨立做單元測試。
 * ========================================================================= */

function isEmptyRow(row) {
  return row && row.persisted === false && String(row.text || "").trim() === "";
}

/**
 * @param {Array} local        目前本地列（含尾端空白列），每列有 persisted 旗標
 * @param {Array} server       伺服器權威 todos（皆為已存檔，依標準順序）
 * @param {Set}   protectedIds 需保留本地版本的列 id（focused ∪ dirty）
 * @param {Function} makeEmpty 產生一列新的空白列
 * @returns {Array} 合併後的新列陣列
 */
export function mergeTodos(local, server, protectedIds, makeEmpty) {
  const prot = protectedIds || new Set();
  const localById = new Map(local.map((r) => [r.id, r]));
  const out = [];
  const used = new Set();

  // 1) 依伺服器順序放入；受保護且本地也有的列 → 保留本地版本（但擺在伺服器位置）
  for (const t of server) {
    const lr = localById.get(t.id);
    if (prot.has(t.id) && lr) {
      out.push(lr);
    } else {
      out.push({
        id: t.id,
        text: t.text,
        done: !!t.done,
        createdAt: t.createdAt,
        completedAt: t.completedAt ?? null,
        persisted: true,
      });
    }
    used.add(t.id);
  }

  // 2) 本地有、但伺服器沒有的列：
  //    - 受保護的列（正在編輯 / 尚未存檔 / 存檔進行中）→ 保留，接在後面
  //    - 其餘（已被別的分頁刪除、或多餘的空白列）→ 丟棄
  for (const r of local) {
    if (used.has(r.id)) continue;
    if (prot.has(r.id)) out.push(r);
  }

  // 3) 確保結尾恰好有一列空白列可輸入
  const last = out[out.length - 1];
  if (!isEmptyRow(last)) out.push(makeEmpty());

  return out;
}
