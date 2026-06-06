import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type GoogleOauthState = {
  userId: string;
  redirectUri: string;
  exp: number;
};

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SYNC_SECRET;

  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET or SYNC_SECRET is required for OAuth state.");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function encodeOauthState(state: GoogleOauthState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeOauthState(value: string): GoogleOauthState {
  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    throw new Error("Invalid OAuth state.");
  }

  const expected = sign(payload);
  const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!isValid) {
    throw new Error("Invalid OAuth state signature.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOauthState;

  if (!parsed.userId || !parsed.redirectUri || parsed.exp < Date.now()) {
    throw new Error("Expired OAuth state.");
  }

  return parsed;
}
