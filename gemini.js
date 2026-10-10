// gemini.js
// The Gemini poker coach. This file runs on the SERVER only (server.js imports it).
// It used to live inside index.html, which meant every visitor's browser held the API key.
// Never load this file from the browser.
//
// What it does:
//   1. Checks the table situation index.html sends (cards, opponents, pot, call, Monte Carlo result).
//   2. Works out pot odds, EV and the recommended action with the same formulas as index.html.
//   3. Builds the coach prompt and sends it, plus the chat history, to the Gemini REST API.
//   4. Turns every failure (bad key, rate limit, timeout, outage...) into a clear message.
//
// Design rule: OUR code does the math. Gemini only explains it. It must never invent odds.

const DEFAULT_MODEL = "gemini-3.8-flash"; // from Google's quickstart; override with GEMINI_MODEL in .env
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_HISTORY_TURNS = 20; // older turns are dropped to keep requests small
const MAX_TEXT_LENGTH = 2000; // max characters per message

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CoachError extends Error {
  constructor(code, httpStatus, message, detail) {
    super(message);
    this.name = "CoachError";
    this.code = code; // short label the frontend can check, e.g. "invalid_api_key"
    this.httpStatus = httpStatus; // status server.js sends back
    this.detail = detail; // extra info for the server log only (never sent to the browser)
  }
}

const badRequest = (message) => new CoachError("bad_request", 400, message);

// ---------------------------------------------------------------------------
// API key (read from the server's environment, i.e. the .env file)
// ---------------------------------------------------------------------------

export function keyIsConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key) && key !== "your_key_here";
}

// ---------------------------------------------------------------------------
// Checking the situation sent by index.html
// ---------------------------------------------------------------------------

const RANKS = "23456789TJQKA";
const SUITS = "shdc";
const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };

// index.html stores cards as { r: "A", s: "h" }. Strings like "Ah" are accepted too.
function normalizeCard(card) {
  let r;
  let s;
  if (typeof card === "string") {
    const t = card.trim();
    r = t.slice(0, -1);
    s = t.slice(-1);
  } else if (card && typeof card === "object") {
    r = card.r;
    s = card.s;
  } else {
    return null;
  }
  r = String(r ?? "").toUpperCase();
  s = String(s ?? "").toLowerCase();
  if (r === "10") r = "T";
  if (r.length !== 1 || s.length !== 1 || !RANKS.includes(r) || !SUITS.includes(s)) return null;
  return r + s;
}

const prettyCard = (card) => `${card[0]}${SUIT_SYMBOL[card[1]]}`;

// Empty table slots are null, so those are skipped.
function readCards(list, name, max) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw badRequest(`${name} must be a list of cards.`);
  const cards = list.filter((c) => c != null).map(normalizeCard);
  if (cards.includes(null)) throw badRequest(`${name} contains an invalid card.`);
  if (cards.length > max) throw badRequest(`${name} can have at most ${max} cards.`);
  return cards;
}

function readNumber(value, name, min, max) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw badRequest(`${name} must be a number between ${min} and ${max}.`);
  }
  return n;
}

// Same formulas as runMonteCarloSimulation() in index.html.
// If you change the math there, change it here too.
export function computeAnalysis({ winPct, tiePct, pot, callAmount, opponents }) {
  const lossPct = Math.max(0, 100 - winPct - tiePct);
  const potOdds = callAmount > 0 ? (callAmount / (pot + callAmount)) * 100 : 0;
  const totalEquityFrac = (winPct + tiePct / 2) / 100; // a tie counts as half a win
  const expectedValue =
    callAmount > 0 ? totalEquityFrac * (pot + callAmount) - callAmount : totalEquityFrac * pot;

  let action;
  if (callAmount === 0) {
    action = winPct > 100 / (opponents + 1) + 15 ? "BET / RAISE" : "CHECK";
  } else if (totalEquityFrac * 100 > potOdds + 12) {
    action = "RAISE / RE-RAISE";
  } else if (totalEquityFrac * 100 >= potOdds) {
    action = "CALL";
  } else {
    action = "FOLD";
  }

  return { winPct, tiePct, lossPct, equityPct: totalEquityFrac * 100, potOdds, expectedValue, action };
}

// Expected shape (this is what index.html's buildSituation() sends):
// {
//   hole:       [{ r: "A", s: "h" }, { r: "K", s: "d" }],   // or nulls if not picked yet
//   board:      [{ r: "J", s: "h" }, null, null, null, null],
//   opponents:  2,
//   pot:        150,
//   callAmount: 50,
//   sim:        { winPct: 38.2, tiePct: 1.1 }  // percentages 0-100, or null if not run yet
// }
export function validateSituation(situation) {
  if (!situation || typeof situation !== "object") {
    throw badRequest("Missing 'situation' object.");
  }

  const hole = readCards(situation.hole, "hole", 2);
  const board = readCards(situation.board, "board", 5);
  const all = [...hole, ...board];
  if (new Set(all).size !== all.length) throw badRequest("The same card appears more than once.");

  const opponents = readNumber(situation.opponents, "opponents", 1, 9);
  if (!Number.isInteger(opponents)) throw badRequest("opponents must be a whole number.");
  const pot = readNumber(situation.pot, "pot", 0, 1e9);
  const callAmount = readNumber(situation.callAmount ?? 0, "callAmount", 0, 1e9);

  let analysis = null;
  if (situation.sim != null) {
    if (hole.length !== 2) throw badRequest("A simulation result needs both hole cards.");
    const winPct = readNumber(situation.sim.winPct, "sim.winPct", 0, 100);
    const tiePct = readNumber(situation.sim.tiePct ?? 0, "sim.tiePct", 0, 100);
    if (winPct + tiePct > 100.01) throw badRequest("sim.winPct + sim.tiePct cannot be more than 100.");
    analysis = computeAnalysis({ winPct, tiePct, pot, callAmount, opponents });
  }

  const street =
    { 0: "Preflop", 3: "Flop", 4: "Turn", 5: "River" }[board.length] ?? "Flop (not all cards picked)";

  return { hole, board, street, opponents, pot, callAmount, analysis };
}

// ---------------------------------------------------------------------------
// The prompt (wording from the original chatbot in index.html, plus guardrails)
// ---------------------------------------------------------------------------

const pct = (n) => `${n.toFixed(1)}%`;
const money = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const signedMoney = (n) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;

export function buildSystemInstruction(s) {
  const holeText = s.hole.length === 2 ? s.hole.map(prettyCard).join(" ") : "None selected";
  const boardText = s.board.length ? `${s.board.map(prettyCard).join(" ")} (${s.street})` : "Preflop (no board cards)";

  const a = s.analysis;
  const simText = a
    ? [
        `- Win: ${pct(a.winPct)} | Tie: ${pct(a.tiePct)} | Loss: ${pct(a.lossPct)}`,
        `- Total equity (win + half of ties): ${pct(a.equityPct)}`,
        `- Required pot odds: ${pct(a.potOdds)}`,
        `- Expected value (EV) of ${s.callAmount > 0 ? "calling" : "continuing"}: ${signedMoney(a.expectedValue)} per decision`,
        `- Recommended action from our engine: ${a.action}`,
      ].join("\n")
    : "Monte Carlo simulation not run yet.";

  return `You are a world-class, friendly Texas Hold'em Poker Coach assisting a beginner player.
Translate raw math into concise, encouraging strategy explanations. Keep responses beginner-friendly, under 3 paragraphs, using bullet points for key tips.

Rules:
- The Monte Carlo numbers below come from our own simulation code. Treat them as correct. Never recalculate, change, or invent win percentages, pot odds, or EV.
- If the simulation has not been run, do not guess a win percentage. Answer the question in general terms and suggest running the simulation for exact numbers.
- Define poker jargon the first time you use it.
- The app does not track table position or opponents' playing styles. If a question depends on them, explain how the answer would change instead of assuming.
- Formatting: plain text, **bold** for key terms, start bullet lines with "- ". No tables or headings.
- This is a learning tool, not gambling advice. Never promise a result.
- Stay on poker. If asked about something unrelated, politely steer back.

Current Table Context:
- Player Hole Cards: ${holeText}
- Community Board: ${boardText}
- Active Opponents: ${s.opponents}
- Current Pot: ${money(s.pot)}
- Amount to Call: ${money(s.callAmount)}

Monte Carlo Engine Stats:
${simText}`;
}

// ---------------------------------------------------------------------------
// Chat history (follow-up questions)
// ---------------------------------------------------------------------------

// index.html keeps the history and sends it with every question:
//   [{ role: "user", text: "..." }, { role: "model", text: "..." }, ...]
// (Gemini's own { role, parts: [{ text }] } shape is accepted too.)
function cleanHistory(history) {
  if (history == null) return [];
  if (!Array.isArray(history)) throw badRequest("history must be a list.");

  const turns = [];
  for (const item of history.slice(-MAX_HISTORY_TURNS)) {
    const role = item?.role === "model" || item?.role === "user" ? item.role : null;
    const raw = typeof item?.text === "string" ? item.text : item?.parts?.[0]?.text;
    const text = typeof raw === "string" ? raw.trim().slice(0, MAX_TEXT_LENGTH) : "";
    if (role && text) turns.push({ role, parts: [{ text }] });
  }
  while (turns.length && turns[0].role !== "user") turns.shift(); // must start with the user
  return turns;
}

// Gemini expects user/model turns to alternate, so join two in a row with the same role.
function mergeSameRole(turns) {
  const merged = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) last.parts[0].text += "\n" + turn.parts[0].text;
    else merged.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Turning any failure into a CoachError with a friendly message
// ---------------------------------------------------------------------------

export function toCoachError(err) {
  if (err instanceof CoachError) return err;

  const status = Number(err?.status) || 0;
  const text = String(err?.message ?? "");

  if (err?.name === "AbortError" || err?.name === "TimeoutError") {
    return new CoachError("timeout", 504, "Gemini took too long to answer. Please try again.", text);
  }
  if (/API key not valid|API_KEY_INVALID|API key expired|API key not found/i.test(text) || status === 401 || status === 403) {
    return new CoachError(
      "invalid_api_key",
      503,
      "The server's Gemini API key is invalid, expired, or not allowed. Check GEMINI_API_KEY in .env and restart the server.",
      text
    );
  }
  if (status === 404) {
    return new CoachError(
      "model_not_found",
      500,
      "Gemini could not find that model. Check GEMINI_MODEL in .env (or delete that line to use the default).",
      text
    );
  }
  if (status === 429) {
    return new CoachError("rate_limited", 429, "Too many requests to Gemini. Wait a few seconds and try again.", text);
  }
  if (status >= 500) {
    return new CoachError("upstream_error", 502, "Gemini is having trouble right now. Please try again.", text);
  }
  if (status === 400) {
    return new CoachError("upstream_rejected", 502, "Gemini rejected the request. Try rephrasing your question.", text);
  }
  return new CoachError(
    "upstream_error",
    502,
    "The server could not reach Gemini. Check its internet connection.",
    text
  );
}

// ---------------------------------------------------------------------------
// The one function server.js calls
// ---------------------------------------------------------------------------

// input:   { situation, message, history }
// returns: { reply, model, analysis }
// `deps` lets tests swap in a fake fetch or key.
export async function askCoach({ situation, message, history } = {}, deps = {}) {
  const sit = validateSituation(situation);
  const pastTurns = cleanHistory(history);

  const question = typeof message === "string" ? message.trim() : "";
  if (!question) throw badRequest("Type a question first.");
  if (question.length > MAX_TEXT_LENGTH) {
    throw badRequest(`Message is too long (max ${MAX_TEXT_LENGTH} characters).`);
  }

  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new CoachError(
      "missing_api_key",
      503,
      "The server has no Gemini API key. Copy .env.example to .env, add GEMINI_API_KEY, and restart the server."
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  // GEMINI_API_BASE is only for testing against a fake Gemini. Leave it unset.
  const base = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const doFetch = deps.fetch ?? fetch;

  const body = {
    systemInstruction: { parts: [{ text: buildSystemInstruction(sit) }] },
    contents: mergeSameRole([...pastTurns, { role: "user", parts: [{ text: question }] }]),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await doFetch(url, {
      method: "POST",
      // The key goes in a header, not the URL, so it doesn't end up in logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const upstream = new Error(data?.error?.message || `HTTP ${res.status}`);
      upstream.status = res.status;
      throw upstream;
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const reply = parts
      .filter((p) => typeof p?.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();

    if (!reply) {
      const why = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "no text";
      throw new CoachError(
        "empty_response",
        502,
        "Gemini returned an empty answer (it may have blocked the reply). Try rephrasing.",
        why
      );
    }

    return { reply, model, analysis: sit.analysis };
  } catch (err) {
    throw toCoachError(err);
  } finally {
    clearTimeout(timer);
  }
}
