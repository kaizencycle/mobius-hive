/**
 * C-414: hive.player_event idempotency contract tests (isolated fixtures only).
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { describe, it } from "node:test";

import {
  buildHivePlayerEventBody,
  generateHiveOperationId,
  getOrCreateOperationId,
  isValidHiveOperationId,
  sanitizeAttestError,
} from "../lib/hive-player-event.mjs";

const FIXTURE = {
  civicId: "mobius-anon-test0001",
  world: "hive-citadel",
  zone: "castle",
  action: "channel_node",
  targetId: "node-fixture-0",
  cycleId: "C-414",
};

function createMockCpcServer() {
  /** @type {Map<string, { fingerprint: string, civic_id: string, response: object }>} */
  const events = new Map();
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/ledger/attest") {
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(body.payload, Object.keys(body.payload).sort()))
      .digest("hex");

    if (body.event_type !== "hive.player_event" || body.lab_source !== "hive") {
      res.writeHead(422);
      res.end(JSON.stringify({ detail: "invalid lane" }));
      return;
    }
    if (!body.operation_id || !/^hive-op-[a-f0-9]{32}$/.test(body.operation_id)) {
      res.writeHead(422);
      res.end(JSON.stringify({ detail: "operation_id required" }));
      return;
    }

    const scopeKey = `${body.civic_id}:${body.operation_id}`;
    const existing = events.get(scopeKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        res.writeHead(409);
        res.end(JSON.stringify({ detail: "payload conflict" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...existing.response, idempotent: true }));
      return;
    }

    if (req.headers["x-simulate-5xx"] === "1") {
      res.writeHead(503);
      res.end(JSON.stringify({ detail: "temporary failure" }));
      return;
    }

    const response = {
      event_id: `evt_fixture_${events.size + 1}`,
      event_type: body.event_type,
      civic_id: body.civic_id,
      lab_source: body.lab_source,
      timestamp: "2026-08-25T00:00:00.000Z",
      event_hash: "abc123",
      confirmed: true,
      idempotent: false,
    };
    events.set(scopeKey, {
      fingerprint,
      civic_id: body.civic_id,
      response,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
  });

  return {
    server,
    events,
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const { port } = server.address();
          resolve(`http://127.0.0.1:${port}`);
        });
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function postBody(baseUrl, body, headers = {}) {
  const res = await fetch(`${baseUrl}/ledger/attest`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { detail: text };
  }
  return { status: res.status, json };
}

describe("generateHiveOperationId", () => {
  it("produces unguessable valid ids", () => {
    const a = generateHiveOperationId();
    const b = generateHiveOperationId();
    assert.notEqual(a, b);
    assert.ok(isValidHiveOperationId(a));
  });

  it("persists operation_id per logical write in storage", () => {
    const storage = new Map();
    const a = getOrCreateOperationId("C-414", "node-0", storage);
    const b = getOrCreateOperationId("C-414", "node-0", storage);
    const c = getOrCreateOperationId("C-414", "node-1", storage);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("includes top-level civic_id and lab_source in attest body", () => {
    const operationId = generateHiveOperationId();
    const body = buildHivePlayerEventBody({
      ...FIXTURE,
      operationId,
      clientTs: "2026-08-25T12:00:00.000Z",
    });
    assert.equal(body.event_type, "hive.player_event");
    assert.equal(body.civic_id, FIXTURE.civicId);
    assert.equal(body.lab_source, "hive");
    assert.equal(body.payload.civic_id, FIXTURE.civicId);
    assert.equal(body.operation_id, operationId);
  });
});

describe("mock CPC idempotency", () => {
  it("first request succeeds", async () => {
    const mock = createMockCpcServer();
    const baseUrl = await mock.listen();
    try {
      const body = buildHivePlayerEventBody({
        ...FIXTURE,
        operationId: generateHiveOperationId(),
      });
      const result = await postBody(baseUrl, body);
      assert.equal(result.status, 200);
      assert.equal(result.json.idempotent, false);
      assert.equal(mock.events.size, 1);
    } finally {
      await mock.close();
    }
  });

  it("identical retry returns the original outcome", async () => {
    const mock = createMockCpcServer();
    const baseUrl = await mock.listen();
    try {
      const operationId = generateHiveOperationId();
      const body = buildHivePlayerEventBody({ ...FIXTURE, operationId });
      const first = await postBody(baseUrl, body);
      const retry = await postBody(baseUrl, body);
      assert.equal(first.status, 200);
      assert.equal(retry.status, 200);
      assert.equal(retry.json.idempotent, true);
      assert.equal(retry.json.event_id, first.json.event_id);
      assert.equal(mock.events.size, 1);
    } finally {
      await mock.close();
    }
  });

  it("same operation_id with different payload fails closed", async () => {
    const mock = createMockCpcServer();
    const baseUrl = await mock.listen();
    try {
      const operationId = generateHiveOperationId();
      const body = buildHivePlayerEventBody({ ...FIXTURE, operationId });
      const first = await postBody(baseUrl, body);
      assert.equal(first.status, 200);
      const conflict = buildHivePlayerEventBody({
        ...FIXTURE,
        operationId,
        action: "restore_beacon",
      });
      const second = await postBody(baseUrl, conflict);
      assert.equal(second.status, 409);
    } finally {
      await mock.close();
    }
  });

  it("same operation_id under different civic_id cannot poison", async () => {
    const mock = createMockCpcServer();
    const baseUrl = await mock.listen();
    try {
      const sharedOp = generateHiveOperationId();
      const attacker = buildHivePlayerEventBody({
        ...FIXTURE,
        civicId: "mobius-anon-attacker1",
        operationId: sharedOp,
        action: "restore_beacon",
      });
      attacker.civic_id = "mobius-anon-attacker1";
      attacker.payload.civic_id = "mobius-anon-attacker1";

      const victim = buildHivePlayerEventBody({
        ...FIXTURE,
        civicId: "mobius-anon-victim01",
        operationId: sharedOp,
      });
      victim.civic_id = "mobius-anon-victim01";
      victim.payload.civic_id = "mobius-anon-victim01";

      const attackerRes = await postBody(baseUrl, attacker);
      const victimRes = await postBody(baseUrl, victim);
      assert.equal(attackerRes.status, 200);
      assert.equal(victimRes.status, 200);
      assert.notEqual(attackerRes.json.event_id, victimRes.json.event_id);
      assert.equal(mock.events.size, 2);
    } finally {
      await mock.close();
    }
  });

  it("5xx retry with identical body deduplicates to one event", async () => {
    const mock = createMockCpcServer();
    const baseUrl = await mock.listen();
    try {
      const operationId = generateHiveOperationId();
      const body = buildHivePlayerEventBody({
        ...FIXTURE,
        targetId: "node-retry-5xx",
        operationId,
      });
      const first = await postBody(baseUrl, body, { "x-simulate-5xx": "1" });
      assert.equal(first.status, 503);
      assert.equal(mock.events.size, 0);
      const second = await postBody(baseUrl, body);
      assert.equal(second.status, 200);
      assert.equal(mock.events.size, 1);
      const third = await postBody(baseUrl, body);
      assert.equal(third.status, 200);
      assert.equal(third.json.idempotent, true);
      assert.equal(mock.events.size, 1);
    } finally {
      await mock.close();
    }
  });
});

describe("sanitizeAttestError", () => {
  it("never exposes civic_id in error strings", () => {
    const err = new Error(`request failed for ${FIXTURE.civicId}`);
    assert.equal(sanitizeAttestError(err), "request failed for [civic_id]");
  });
});
