import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PROPOSAL = path.join(ROOT, "ledger", "quest-proposals", "latest.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function authHeaders(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
}

async function githubJson(url, token, init) {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(token), ...init?.headers } });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message ?? text;
    throw new Error(`GitHub API error (${res.status}): ${msg}`);
  }
  return json;
}

async function main() {
  if (!fs.existsSync(PROPOSAL)) {
    console.error("mobius-hive: missing ledger/quest-proposals/latest.json — run generate-quest-proposal first");
    process.exitCode = 1;
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    console.log(
      "mobius-hive: skipping PR creation (set GITHUB_TOKEN and GITHUB_REPOSITORY in Actions to enable)",
    );
    return;
  }

  const proposal = readJson(PROPOSAL);
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
  }

  const apiRoot = (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "");
  const base = `${apiRoot}/repos/${owner}/${repo}`;

  const branch = proposal.suggested_branch;
  const baseBranch =
    process.env.GITHUB_BASE_REF ||
    process.env.GITHUB_REF_NAME ||
    (await githubJson(`${base}`, token, { method: "GET" })).default_branch ||
    "main";

  const baseRef = await githubJson(`${base}/git/ref/heads/${baseBranch}`, token, {
    method: "GET",
  });
  const baseSha = baseRef.object.sha;

  await githubJson(`${base}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  }).catch((err) => {
    if (!String(err).includes("422")) throw err;
    console.log(`mobius-hive: branch ${branch} already exists; updating contents on it`);
  });

  const markerPath = `ledger/quest-proposals/pr-${proposal.cycle_id}.marker.json`;
  const marker = {
    schema_version: 1,
    created_at: proposal.generated_at,
    cycle_id: proposal.cycle_id,
    note: "Marker file for automated quest proposal PR (replace with real quest deltas when wired).",
  };
  const content = Buffer.from(`${JSON.stringify(marker, null, 2)}\n`, "utf8").toString("base64");

  const encodedPath = markerPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  let existingSha = null;
  const existing = await fetch(`${base}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  });
  if (existing.ok) {
    existingSha = (await existing.json()).sha;
  }

  await githubJson(`${base}/contents/${encodedPath}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore(hive): quest proposal marker for ${proposal.cycle_id}`,
      content,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  const prBody = [
    "## Mobius HIVE — automated quest proposal",
    "",
    "This PR was opened by `quest-proposal.yml` using `scripts/world/open-quest-pr.js`.",
    "",
    "### Governance",
    "- Agents may propose; they must not auto-merge.",
    "- Required reviewers: **ZEUS**, **ATLAS** (see `mobius.yaml`).",
    "",
    "### Proposal snapshot",
    "```json",
    JSON.stringify(proposal, null, 2),
    "```",
    "",
    "### Next",
    "- Replace marker file with real quest/event JSON when Sentinel generation is wired.",
  ].join("\n");

  const pr = await githubJson(`${base}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({
      title: proposal.title,
      head: branch,
      base: baseBranch,
      body: prBody,
      draft: true,
    }),
  });

  console.log(`mobius-hive: opened draft PR #${pr.number}: ${pr.html_url}`);
}

await main();
