import { describe, expect, it } from "bun:test";
import { buildCsp } from "../../src/lib/csp";

describe("INFRA-03 — CSP builder", () => {
  it("production: ENFORCE با nonce و strict-dynamic، بدون unsafe-eval", () => {
    const { policy, reportOnly } = buildCsp({ nonce: "ABC123", isProduction: true });
    expect(reportOnly).toBe(false);
    expect(policy).toContain("'nonce-ABC123'");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("report-uri /api/csp-report");
  });

  it("dev: Report-Only با unsafe-inline/eval (HMR/React Refresh)", () => {
    const { policy, reportOnly } = buildCsp({ isProduction: false });
    expect(reportOnly).toBe(true);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("'unsafe-inline'");
  });
});
