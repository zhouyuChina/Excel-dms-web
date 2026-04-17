/// <reference types="node" />
import "dotenv/config";

type Scenario = {
  name: string;
  pageSize: number;
  q?: string;
  provider?: string;
  country?: string;
  exportStatus?: "all" | "exported" | "not-exported";
};

const API_BASE = process.env.LOADTEST_API_BASE || "http://127.0.0.1:8080";
const ROUNDS = Number(process.env.LOADTEST_ROUNDS || 50);

async function runScenario(s: Scenario): Promise<{ p95: number; avg: number }> {
  const durations: number[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < ROUNDS; i += 1) {
    const sp = new URLSearchParams();
    sp.set("pageSize", String(s.pageSize));
    if (s.q) sp.set("q", s.q);
    if (s.provider) sp.set("provider", s.provider);
    if (s.country) sp.set("country", s.country);
    if (s.exportStatus && s.exportStatus !== "all") sp.set("exportStatus", s.exportStatus);
    if (cursor) sp.set("cursor", cursor);
    const started = Date.now();
    const res = await fetch(`${API_BASE}/api/customers?${sp.toString()}`);
    const ended = Date.now();
    durations.push(ended - started);
    if (!res.ok) throw new Error(`${s.name} failed: ${res.status}`);
    const json = (await res.json()) as { nextCursor?: string | null };
    cursor = json.nextCursor || null;
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length));
  return { p95, avg };
}

async function main() {
  const providerFilterValue = process.env.LOADTEST_PROVIDER || "人事";
  const scenarios: Scenario[] = [
    { name: "baseline", pageSize: 50, exportStatus: "all" },
    { name: "provider-filter", pageSize: 50, provider: providerFilterValue, exportStatus: "all" },
    { name: "exported-only", pageSize: 50, exportStatus: "exported" },
  ];
  console.log(`Loadtest API=${API_BASE} rounds=${ROUNDS}`);
  for (const s of scenarios) {
    const { p95, avg } = await runScenario(s);
    console.log(`${s.name}: avg=${avg}ms p95=${p95}ms`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

