// 共用 API 封裝與型別
// - 以 VITE_API_URL 當作後端 base URL
// - 提供簡單的預設回退，讓未設定後端時也能正常開發

export type Health = {
  ok: boolean;
  db?: boolean;
};

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const base = (import.meta as any).env?.VITE_API_URL as string | undefined;

  // 未設定後端時，預設為 online，方便前端開發
  if (!base) {
    return { ok: true, db: true };
  }

  const res = await fetch(`${base}/api/health`, { signal });
  if (!res.ok) throw new Error('health failed');
  return res.json() as Promise<Health>;
}

export type FooterInfo = {
  user: string;
  version: string;
  serverTime: string; // ISO string
  perf: number; // 0~1
  ok: boolean;
  db: boolean;
};

export async function fetchFooter(signal?: AbortSignal): Promise<FooterInfo> {
  const base = (import.meta as any).env?.VITE_API_URL as string | undefined;

  // 未設定後端：回傳假資料
  if (!base) {
    return {
      user: '管理員',
      version: 'v1.0.0',
      serverTime: new Date().toISOString(),
      perf: 0.8,
      ok: true,
      db: true,
    };
  }

  const [healthRes, footerRes] = await Promise.all([
    fetch(`${base}/api/health`, { signal }),
    fetch(`${base}/api/footer`, { signal }),
  ]);

  if (!healthRes.ok || !footerRes.ok) {
    throw new Error('footer fetch failed');
  }

  const health = (await healthRes.json().catch(() => ({}))) as Partial<Health>;
  const footer = (await footerRes.json().catch(() => ({}))) as Partial<FooterInfo>;

  return {
    user: footer.user ?? 'unknown',
    version: footer.version ?? '',
    serverTime: footer.serverTime ?? new Date().toISOString(),
    perf: typeof footer.perf === 'number' ? footer.perf : 0.8,
    ok: !!health?.ok,
    db: health?.db === undefined ? true : !!health.db,
  };
}



