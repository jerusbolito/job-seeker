export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

const MAX_LINES = 1500;

// LCS-based line diff. For very large inputs, falls back to a positional
// comparison so it can't blow up on pathological cases.
export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split(/\r?\n/);
  const B = b.split(/\r?\n/);
  const m = A.length;
  const n = B.length;

  if (m > MAX_LINES || n > MAX_LINES) {
    const out: DiffLine[] = [];
    for (let i = 0; i < Math.max(m, n); i++) {
      if (i < m && i < n && A[i] === B[i]) out.push({ type: "same", text: A[i] });
      else {
        if (i < m) out.push({ type: "del", text: A[i] });
        if (i < n) out.push({ type: "add", text: B[i] });
      }
    }
    return out;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: A[i] });
      i++;
    } else {
      out.push({ type: "add", text: B[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: A[i++] });
  while (j < n) out.push({ type: "add", text: B[j++] });
  return out;
}
