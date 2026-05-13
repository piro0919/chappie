#!/usr/bin/env node
// Multi-turn tool-routing regression test for Free / BYOK paths.
//
// Covers what `golden_tool_routing.rs` does NOT: the multi-turn
// context-bias bug where Flash (and to a lesser extent gpt-4o-mini)
// re-uses the most recent successful tool when the next user utterance
// is on a different topic. Single-utterance routing is covered by the
// Rust golden test; this one chains turns and asserts each turn picks
// the right tool given the running conversation history.
//
// Providers:
//  - gemini: goes through the local LP proxy (Gemini wire format)
//  - openai: direct OpenAI Chat Completions API
//
// Run:
//   node scripts/test-tool-routing.mjs           # both providers
//   PROVIDER=gemini node scripts/test-tool-routing.mjs
//   PROVIDER=openai node scripts/test-tool-routing.mjs
//
// Requires:
//   - PROVIDER=gemini: LP proxy + Supabase running locally
//   - PROVIDER=openai: OPENAI_API_KEY env var

import { existsSync, readFileSync } from "node:fs";

// Load .env.golden manually if present (no dotenv dep). Existing env wins.
const ENV_FILE = new URL("../.env.golden", import.meta.url).pathname;
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const PROXY_URL = process.env.CHAPPIE_PROXY_URL ?? "http://localhost:3000/api/chat";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_TEST_MODEL ?? "gpt-4o-mini";
const HISTORY_CAP = 4; // mirror src/lib/conversation-history.ts MAX_NON_SYSTEM

// Pulled from src/i18n/messages.ts ja.systemPrompt.persona — the
// load-bearing parts for tool selection. Keep in sync manually.
const PERSONA = `あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。

**「できない」を可能な限り避けること**。tool list は道具の一覧であって、あなたができることの全リストではない。占い・ジョーク・物語の創作・相談・翻訳・要約・歌詞作り・名前決め・雑学・気休めの一言など、tool が要らない依頼は普通に生成で応じる。

**曖昧な query は assistant 自身への問いとして扱うこと**。『調子はどう？』『元気？』『どう？』など対象が明示されない短い問いは、原則あなた自身への問いかけ。直前のターンで \`get_weather\` などの tool を呼んでいても、ユーザーが『そっちの〜』『今の〜』のような指示語で対象を明示しない限り、同じ tool を再度呼ばずに会話で応じること。

**tool 選択の鉄則：今のユーザー発話だけを見て選ぶ**。直前のターンでどの tool を使ったかは完全に無視する。会話履歴に他の tool の結果が残っていても、新しい発話がそれと関係なければ引きずられない。発話に含まれる動詞・名詞・数値だけを見て literal に対応する tool を選ぶこと。例：『○分タイマー』『N秒後に教えて』→ \`set_timer\`、『今何時』『今日何曜日』→ \`get_current_time\`、『バッテリー』『充電』『電源』→ \`get_battery_status\`、『天気』『気温』『雨』『晴れ』→ \`get_weather\`、『音量』→ \`set_volume\` / \`get_volume\`。リクエストが上記キーワードを明確に含むのに別の tool を選ぶのは厳禁。`;

// Subset of tools.rs `all_tools()`. The multi-turn bias bug is between
// these 5 — adding the full 38 doesn't materially change behavior (the
// Rust golden test covers single-utterance routing across all 38).
const TOOLS = [
  {
    name: "get_current_time",
    description: "現在の日付と時刻（ローカル）を返す。「今何時?」「今日何曜日?」など時刻系質問では必ず先にこれを呼ぶ。",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "set_timer",
    description: "指定秒数後に発火するタイマー。「3分タイマー」「10分後に教えて」「1時間半セットして」。分・時間は秒換算（3分=180）。label は用途名（任意）。",
    parameters: {
      type: "object",
      properties: {
        duration_seconds: { type: "integer", minimum: 1 },
        label: { type: "string" },
      },
      required: ["duration_seconds"],
    },
  },
  {
    name: "get_weather",
    description: "天気を返す（現在 + 今日 + 明日）。「今日の天気」「明日雨?」「気温何度?」。location 省略でユーザーの現在地。",
    parameters: {
      type: "object",
      properties: { location: { type: "string" } },
    },
  },
  {
    name: "get_battery_status",
    description: "バッテリー残量・充電状態・残り時間。「バッテリー何%?」「充電あとどれくらい?」「電源繋いでる?」。",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "end_conversation",
    description: "ユーザーが会話を終わらせる意図（「ありがとう」「またね」「以上」など）を示したら呼ぶ。",
    parameters: { type: "object", properties: {} },
  },
];

const MOCK_RESULTS = {
  get_weather: () =>
    "[東京都 (日本)]\n現在: 晴れ, 14.5℃, 風速 3.3m/s\n今日: 霧雨, 最高 24.4℃ / 最低 14.0℃, 降水確率 94%",
  get_current_time: () => JSON.stringify({ iso: "2026-05-14T03:00:00+09:00", weekday: "木" }),
  set_timer: (args) =>
    JSON.stringify({ id: 1, duration: `${args.duration_seconds}秒`, label: args.label ?? "" }),
  get_battery_status: () =>
    JSON.stringify({ percent: 80, is_plugged_in: true, is_charging: false, has_battery: true }),
  end_conversation: () => JSON.stringify({ ok: true }),
};

// ---------- Scenarios ----------

const SCENARIOS = [
  {
    name: "weather → 調子 → battery → timer → 何時",
    description: "the original sequence that exhibited the bias bug",
    turns: [
      { user: "今日の天気は？", expectTools: ["get_weather"] },
      { user: "調子はどう？", expectTools: [] },
      { user: "バッテリーは何パーセント？", expectTools: ["get_battery_status"] },
      { user: "タイマー 10 秒", expectTools: ["set_timer"] },
      { user: "今何時？", expectTools: ["get_current_time"] },
    ],
  },
  {
    name: "battery → timer → weather → 何時 → 調子",
    description: "mixed-tool sequence; each turn switches tool family",
    turns: [
      { user: "バッテリーは？", expectTools: ["get_battery_status"] },
      { user: "5 秒のタイマーセットして", expectTools: ["set_timer"] },
      { user: "東京の天気教えて", expectTools: ["get_weather"] },
      { user: "今何時？", expectTools: ["get_current_time"] },
      { user: "元気？", expectTools: [] },
    ],
  },
];

// ---------- Provider abstraction ----------

// Internal "rolling history" entry: just user text + assistant text.
// We do NOT keep intra-turn tool-call/tool-result records — that
// matches conversation-history.ts which only persists final replies.
const rollingHistory = [];

function appendHistory(role, text) {
  rollingHistory.push({ role, text });
  while (rollingHistory.length > HISTORY_CAP) rollingHistory.shift();
}

function resetHistory() {
  rollingHistory.length = 0;
}

function uuid() {
  return crypto.randomUUID();
}

// ---------- Gemini provider (via local LP proxy) ----------

async function geminiConsumeSSE(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const toolCalls = [];
  let text = "";
  const drain = (raw) => {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        const cand = evt.candidates?.[0];
        for (const part of cand?.content?.parts ?? []) {
          if (part.text) text += part.text;
          if (part.functionCall) {
            toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
          }
        }
      } catch {}
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      drain(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
    }
  }
  if (buf.trim()) drain(buf);
  return { toolCalls, text };
}

async function geminiRunTurn(userText) {
  // Build Gemini contents from rolling history + new user message.
  const contents = rollingHistory.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });

  const turnId = uuid();
  const callsThisTurn = [];
  let finalText = "";

  for (let round = 0; round < 4; round++) {
    const body = {
      system_instruction: { parts: [{ text: PERSONA }] },
      contents,
      tools: [{ function_declarations: TOOLS }],
    };
    const resp = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chappie-Device-Id": process.env.CHAPPIE_DEVICE_ID ?? `harness-${Date.now()}`,
        "X-Chappie-Turn-Id": turnId,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`gemini HTTP ${resp.status}: ${await resp.text()}`);
    }
    const { toolCalls, text } = await geminiConsumeSSE(resp);
    if (text) finalText += text;

    const allMarker =
      toolCalls.length > 0 && toolCalls.every((c) => c.name === "end_conversation");
    if (toolCalls.length === 0 || (allMarker && text)) {
      for (const c of toolCalls) callsThisTurn.push(c.name);
      break;
    }

    const modelTurn = {
      role: "model",
      parts: toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
    };
    if (text) modelTurn.parts.unshift({ text });
    contents.push(modelTurn);

    const responseTurn = { role: "user", parts: [] };
    for (const c of toolCalls) {
      callsThisTurn.push(c.name);
      const mock = MOCK_RESULTS[c.name];
      const result = mock ? mock(c.args) : `{"ok":false}`;
      responseTurn.parts.push({ functionResponse: { name: c.name, response: { result } } });
    }
    contents.push(responseTurn);
  }

  appendHistory("user", userText);
  if (finalText) appendHistory("assistant", finalText);
  return { callsThisTurn, finalText };
}

// ---------- OpenAI provider (direct API) ----------

async function openaiRunTurn(userText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  // OpenAI messages array (system + history + new user)
  const messages = [
    { role: "system", content: PERSONA },
    ...rollingHistory.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: userText },
  ];

  const tools = TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const callsThisTurn = [];
  let finalText = "";

  for (let round = 0; round < 4; round++) {
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, tools }),
    });
    if (!resp.ok) {
      throw new Error(`openai HTTP ${resp.status}: ${await resp.text()}`);
    }
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];
    const text = msg?.content ?? "";
    if (text) finalText += text;

    const allMarker =
      toolCalls.length > 0 &&
      toolCalls.every((c) => c.function?.name === "end_conversation");
    if (toolCalls.length === 0 || (allMarker && text)) {
      for (const c of toolCalls) callsThisTurn.push(c.function.name);
      break;
    }

    // Push the assistant turn + tool results, continue.
    messages.push(msg);
    for (const c of toolCalls) {
      callsThisTurn.push(c.function.name);
      const args = JSON.parse(c.function.arguments || "{}");
      const mock = MOCK_RESULTS[c.function.name];
      const result = mock ? mock(args) : `{"ok":false}`;
      messages.push({ role: "tool", tool_call_id: c.id, content: result });
    }
  }

  appendHistory("user", userText);
  if (finalText) appendHistory("assistant", finalText);
  return { callsThisTurn, finalText };
}

// ---------- Runner ----------

async function runScenario(provider, scenario) {
  resetHistory();
  console.log(`  Scenario: ${scenario.name}`);
  let pass = 0;
  let fail = 0;
  const runTurn = provider === "gemini" ? geminiRunTurn : openaiRunTurn;
  for (let i = 0; i < scenario.turns.length; i++) {
    const { user, expectTools } = scenario.turns[i];
    try {
      const { callsThisTurn, finalText } = await runTurn(user);
      const actual = callsThisTurn.filter((c) => c !== "end_conversation");
      const expected = expectTools;
      const ok =
        actual.length === expected.length &&
        actual.every((c, i) => c === expected[i]);
      const tag = ok ? "✅" : "❌";
      console.log(
        `    Turn ${i + 1} ${tag}  "${user}"  tools=[${actual.join(",") || "(none)"}]  expected=[${expected.join(",") || "(none)"}]`,
      );
      if (!ok) console.log(`      reply: ${finalText.slice(0, 100)}`);
      if (ok) pass++; else fail++;
    } catch (e) {
      console.log(`    Turn ${i + 1} ERROR: ${e.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

async function main() {
  const wantProvider = process.env.PROVIDER?.toLowerCase();
  const providers = wantProvider ? [wantProvider] : ["gemini", "openai"];

  let totalPass = 0;
  let totalFail = 0;

  for (const provider of providers) {
    console.log(`\n=== ${provider.toUpperCase()} ===`);
    if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      console.log("  skipped: OPENAI_API_KEY not set");
      continue;
    }
    for (const scenario of SCENARIOS) {
      const { pass, fail } = await runScenario(provider, scenario);
      totalPass += pass;
      totalFail += fail;
    }
  }

  console.log(`\nResult: ${totalPass} pass / ${totalFail} fail`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main();
