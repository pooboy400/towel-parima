// تولید بدنه‌های آزمایش csp-report — 57-a
import { writeFileSync } from "node:fs";
const dir = "qa-reports/tmp-57a";
// (ب) سالم کوچک ~200B
const small = JSON.stringify({ "csp-report": { "document-uri": "https://qa57a.test/small", "violated-directive": "script-src", "blocked-uri": "inline" }, marker: "QA57A-SMALL" });
writeFileSync(`${dir}/csp-small.json`, small);
// (الف) ~110KB با JSON معتبر
const big = JSON.stringify({ "csp-report": { "document-uri": "https://qa57a.test/big", "violated-directive": "script-src", "sample": "x".repeat(110 * 1024) } });
writeFileSync(`${dir}/csp-big-110k.json`, big);
// (ج) chunked ~100KB
const chunk100 = JSON.stringify({ "csp-report": { "document-uri": "https://qa57a.test/chunk100", "violated-directive": "script-src", "sample": "y".repeat(100 * 1024) } });
writeFileSync(`${dir}/csp-chunk-100k.json`, chunk100);
// (د) مرز: دقیقاً 4096 و 4097 بایت
const base = (pad: number) => JSON.stringify({ "csp-report": { "document-uri": "https://qa57a.test/boundary" }, pad: "a".repeat(pad) });
let pad = 3800;
let body = base(pad);
// تنظیم دقیق روی 4096
while (Buffer.byteLength(body) < 4096) { pad += 1; body = base(pad); }
while (Buffer.byteLength(body) > 4096) { pad -= 1; body = base(pad); }
writeFileSync(`${dir}/csp-4096.json`, body);
writeFileSync(`${dir}/csp-4097.json`, body.slice(0, -1) + "b"); // همان طول+1؟ نه: یک کاراکتر بیشتر
const body4097 = body + "b"; // 4097 بایت — ولی JSON نامعتبر می‌شود! به‌جای آن pad+1
const body4097v = base(pad + 1);
writeFileSync(`${dir}/csp-4097.json`, body4097v);
console.log(JSON.stringify({ small: Buffer.byteLength(small), big: Buffer.byteLength(big), chunk100: Buffer.byteLength(chunk100), b4096: Buffer.byteLength(body), b4097: Buffer.byteLength(body4097v) }));
