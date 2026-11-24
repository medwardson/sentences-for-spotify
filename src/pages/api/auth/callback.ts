import type { NextApiRequest, NextApiResponse } from "next";
import { clearCookie, requestToken, tokenCookies } from "../../../utils/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { code, state, error } = req.query;
    const expectedState = req.cookies.oauth_state;
    const cookies = [clearCookie("oauth_state", "/api/auth")];

    const failure = error
        ? `spotify error ${error}`
        : typeof code !== "string"
          ? "missing code"
          : !expectedState
            ? "missing state cookie"
            : state !== expectedState
              ? "state mismatch"
              : null;

    if (failure || typeof code !== "string") {
        console.warn(`Login failed: ${failure}`);
        res.setHeader("Set-Cookie", cookies);
        return res.redirect(302, "/");
    }

    const token = await requestToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback",
    }).catch(() => null);

    if (!token) {
        console.warn("Login failed: token exchange rejected");
        res.setHeader("Set-Cookie", cookies);
        return res.redirect(302, "/");
    }

    res.setHeader("Set-Cookie", [...cookies, ...tokenCookies(token)]);
    res.redirect(302, "/loading");
}
