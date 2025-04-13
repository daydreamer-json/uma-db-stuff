import wcwidth from 'wcwidth';

/**
 * セルを指定幅にパディングして揃えます。
 * @param text セル文字列
 * @param width 列幅
 * @param align 0=左寄せ, 1=中央, 2=右寄せ
 */
function pad(text: string, width: number, align: 0 | 1 | 2): string {
  const w = [...text].reduce((sum, ch) => sum + wcwidth(ch), 0);
  const padLen = Math.max(width - w, 0);
  if (align === 2) return ' '.repeat(padLen) + text;
  if (align === 1) {
    const left = Math.floor(padLen / 2);
    return ' '.repeat(left) + text + ' '.repeat(padLen - left);
  }
  // align === 0
  return text + ' '.repeat(padLen);
}

/**
 * Markdown テーブルを生成します。
 * @param rows 2次元配列（rows[0] がヘッダ）
 * @param aligns 各列の揃え 0=左,1=中,2=右
 */
export function genTable(rows: string[][], aligns: Array<0 | 1 | 2>): string {
  if (rows.length === 0) return '';

  const cols = rows[0]!.length;
  // 各列の最大幅を wcwidth で計算
  const widths = Array(cols).fill(0);
  for (const row of rows) {
    for (let i = 0; i < cols; i++) {
      const cell = row[i] ?? '';
      const w = [...cell].reduce((s, ch) => s + wcwidth(ch), 0);
      widths[i] = Math.max(widths[i], w, 3);
    }
  }

  // ヘッダ行
  const header = '| ' + rows[0]!.map((c, i) => pad(c, widths[i], aligns[i] ?? 0)).join(' | ') + ' |';

  // 区切り行（: と - でアライメント指定）
  const divider =
    '| ' +
    widths
      .map((w, i) => {
        switch (aligns[i]) {
          case 2:
            return '-'.repeat(w - 1) + ':';
          case 1:
            return ':' + '-'.repeat(w - 2) + ':';
          default:
            return ':' + '-'.repeat(w - 1);
        }
      })
      .join(' | ') +
    ' |';

  // ボディ行
  const body = rows
    .slice(1)
    .map((row) => '| ' + row.map((c, i) => pad(c ?? '', widths[i], aligns[i] ?? 0)).join(' | ') + ' |')
    .join('\n');

  return [header, divider, body].join('\n');
}

export default { genTable };
