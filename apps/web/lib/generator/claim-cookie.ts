export const CLAIM_COOKIE_NAME = "invoicey_claim";
const CLAIM_COOKIE_MAX_AGE_SEC = 60 * 30;

export function claimCookieOptions(token: string): {
  name: string;
  value: string;
  attributes: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  return {
    name: CLAIM_COOKIE_NAME,
    value: token,
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CLAIM_COOKIE_MAX_AGE_SEC,
    },
  };
}

export function expiredClaimCookie(): {
  name: string;
  value: string;
  attributes: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  return {
    name: CLAIM_COOKIE_NAME,
    value: "",
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}
