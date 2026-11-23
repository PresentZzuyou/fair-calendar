import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";

const catalogPath = "app/fairs.generated.json";
const previousCatalog = JSON.parse(execFileSync("git", ["show", `HEAD:${catalogPath}`], { encoding: "utf8" }));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const report = JSON.parse(await readFile("app/crawl-report.generated.json", "utf8"));
const errors = [];

if (process.env.FAIR_CRAWL_OUTCOME !== "success" ||
    !report.runId || !report.runAttempt ||
    report.runId !== process.env.GITHUB_RUN_ID ||
    report.runAttempt !== process.env.GITHUB_RUN_ATTEMPT) {
  errors.push("이번 실행의 정상 수집 기록을 확인할 수 없습니다.");
}

const checkedIds = new Set((report.results ?? []).map(result => result.id));
const publishedIds = new Set(catalog.map(fair => fair.id));
if (report.coverage?.registered !== previousCatalog.length ||
    checkedIds.size !== previousCatalog.length ||
    report.results?.length !== previousCatalog.length) {
  errors.push("등록 행사 수와 점검 결과 수가 일치하지 않습니다.");
}
for (const fair of previousCatalog) {
  if (!checkedIds.has(fair.id)) errors.push(`점검 기록 누락 · ${fair.title}`);
  if (!publishedIds.has(fair.id)) errors.push(`행사 목록에서 사라짐 · ${fair.title}`);
}

const publishedSchedules = new Set(catalog.map(fair => JSON.stringify([fair.title, fair.start, fair.end])));
for (const fair of report.discovered ?? []) {
  if (!publishedSchedules.has(JSON.stringify([fair.title, fair.start, fair.end]))) {
    errors.push(`발견한 일정이 목록에 없음 · ${fair.title}`);
  }
}

const gaps = report.coverage?.editionGaps ?? [];
for (const { seriesKey, start, end } of gaps) {
  console.warn(`::warning::회차 공백 · ${seriesKey} ${start === end ? start : `${start}~${end}`}`);
}

const needsReview = report.coverage?.review ?? [];
const lines = [
  "## 일일 일정 누락 점검",
  "",
  `기존 등록 ${previousCatalog.length}건 · 출처 재확인 ${needsReview.length}개 · 회차 공백 ${gaps.length}개`,
  ...(errors.length ? errors.map(error => `- ${error}`) : ["", "수집 결과와 게시 예정 목록이 일치합니다."]),
];
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
for (const error of errors) console.error(error);
if (errors.length) process.exitCode = 1;
