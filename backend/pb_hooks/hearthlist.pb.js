/// <reference path="../types.d.ts" />

// ===========================================================
// Custom route: POST /api/hearthlist/households
// Creates a household, generates a 6-char invite code,
// sets the caller's household field, returns the household.
// ===========================================================
routerAdd("POST", "/api/hearthlist/households", (e) => {
  const auth = e.auth || (e.requestInfo && e.requestInfo().auth);
  if (!auth || !auth.id) {
    return e.json(401, { message: "Authentication required" });
  }

  // Check user doesn't already have a household
  const user = e.app.findRecordById("users", auth.id);
  if (user.get("household")) {
    try {
      const existing = e.app.findRecordById("households", user.get("household"));
      return e.json(200, {
        id: existing.id,
        name: existing.getString("name"),
        invite_code: existing.getString("invite_code"),
      });
    } catch {
      return e.json(400, { message: "Already in a household" });
    }
  }

  const info = e.requestInfo();
  const body = info.body || {};
  const name = (body["name"] || "").trim();
  if (!name || name.length < 1 || name.length > 60) {
    return e.json(422, { message: "Name must be 1–60 characters" });
  }

  // Generate a unique 6-char invite code (no I, O, 0, 1 for readability)
  const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function genCode() {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return code;
  }

  let inviteCode = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = genCode();
    try {
      e.app.findFirstRecordByData("households", "invite_code", candidate);
      // exists, try again
    } catch {
      inviteCode = candidate;
      break;
    }
  }
  if (!inviteCode) {
    return e.json(500, { message: "Could not generate a unique invite code" });
  }

  const householdsCollection = e.app.findCollectionByNameOrId("households");
  const household = new Record(householdsCollection, {
    name: name,
    invite_code: inviteCode,
  });
  e.app.save(household);

  // Set the user's household
  user.set("household", household.id);
  e.app.save(user);

  return e.json(200, {
    id: household.id,
    name: household.getString("name"),
    invite_code: household.getString("invite_code"),
  });
});

// ===========================================================
// Custom route: POST /api/hearthlist/join
// Joins a household by invite code.
// Invalid codes return a generic 404.
// ===========================================================

// Simple in-memory rate limiter: max 10 attempts per IP per 5 minutes
const joinAttempts = {};
const JOIN_WINDOW_MS = 5 * 60 * 1000;
const JOIN_MAX = 10;

routerAdd("POST", "/api/hearthlist/join", (e) => {
  const auth = e.auth || (e.requestInfo && e.requestInfo().auth);
  if (!auth || !auth.id) {
    return e.json(401, { message: "Authentication required" });
  }

  // Rate limit by IP
  const ip = e.realIP();
  const now = Date.now();
  if (!joinAttempts[ip]) joinAttempts[ip] = [];
  joinAttempts[ip] = joinAttempts[ip].filter((t) => now - t < JOIN_WINDOW_MS);
  if (joinAttempts[ip].length >= JOIN_MAX) {
    return e.json(429, { message: "Too many attempts. Please try again later." });
  }
  joinAttempts[ip].push(now);

  const info = e.requestInfo();
  const body = info.body || {};
  const code = (body["code"] || "").trim().toUpperCase();

  let household;
  try {
    household = e.app.findFirstRecordByData("households", "invite_code", code);
  } catch {
    // Generic message so attackers cannot enumerate valid codes
    return e.json(404, { message: "That code doesn't match a household." });
  }

  const user = e.app.findRecordById("users", auth.id);
  user.set("household", household.id);
  e.app.save(user);

  return e.json(200, {
    id: household.id,
    name: household.getString("name"),
    invite_code: household.getString("invite_code"),
  });
});

// ===========================================================
// Conflict-guard hook: items — onRecordUpdateRequest
// LWW per field group (content_at, state_at).
// Clamp timestamps > 5 min in the future to server now.
// If all submitted groups are stale, return 409 stale_write.
// ===========================================================
onRecordUpdateRequest((e) => {
  const info = e.requestInfo();
  const bodyData = info.body || {};
  const record = e.record;

  const serverNow = Date.now();
  const CLAMP_MS = 5 * 60 * 1000;

  // Clamp timestamps
  for (const field of ["content_at", "state_at"]) {
    if (bodyData[field] !== undefined && Number(bodyData[field]) > serverNow + CLAMP_MS) {
      bodyData[field] = serverNow;
      record.set(field, serverNow);
    }
  }

  // Content group fields
  const contentFields = ["name", "quantity", "unit", "note", "category", "content_at"];
  const stateFields   = ["checked", "checked_by", "checked_at", "deleted_at", "state_at"];

  const hasContent = contentFields.some((f) => bodyData[f] !== undefined);
  const hasState   = stateFields.some((f) => bodyData[f] !== undefined);

  let contentStale = false;
  let stateStale   = false;

  const storedContentAt = record.getInt("content_at");
  const storedStateAt   = record.getInt("state_at");

  if (hasContent && bodyData["content_at"] !== undefined) {
    if (Number(bodyData["content_at"]) < storedContentAt) {
      for (const f of contentFields) delete bodyData[f];
      contentStale = true;
    }
  }

  if (hasState && bodyData["state_at"] !== undefined) {
    if (Number(bodyData["state_at"]) < storedStateAt) {
      for (const f of stateFields) delete bodyData[f];
      stateStale = true;
    }
  }

  // If every submitted group was stale → 409
  const allStale = (hasContent ? contentStale : true) && (hasState ? stateStale : true);
  if (hasContent && hasState && allStale) {
    throw new ApiError(409, "stale_write", { code: "stale_write" });
  }
  if (hasContent && !hasState && contentStale) {
    throw new ApiError(409, "stale_write", { code: "stale_write" });
  }
  if (hasState && !hasContent && stateStale) {
    throw new ApiError(409, "stale_write", { code: "stale_write" });
  }

  e.next();
}, "items");

// ===========================================================
// Conflict-guard hook: lists — onRecordUpdateRequest
// Single client_updated_at field, same clamp and stale logic.
// ===========================================================
onRecordUpdateRequest((e) => {
  const info = e.requestInfo();
  const bodyData = info.body || {};
  const record = e.record;

  const serverNow = Date.now();
  const CLAMP_MS = 5 * 60 * 1000;

  if (bodyData["client_updated_at"] !== undefined) {
    if (Number(bodyData["client_updated_at"]) > serverNow + CLAMP_MS) {
      bodyData["client_updated_at"] = serverNow;
      record.set("client_updated_at", serverNow);
    }
    if (Number(bodyData["client_updated_at"]) < record.getInt("client_updated_at")) {
      throw new ApiError(409, "stale_write", { code: "stale_write" });
    }
  }

  e.next();
}, "lists");
