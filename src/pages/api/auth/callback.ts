import type { NextApiRequest, NextApiResponse } from "next";
import { clearCookie, cookie, deleteDataCookie, deleteDataPath, deleteDataStatePrefix, requestToken, tokenCookies } from "../../../utils/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { code, state, error } = req.query;
    const expectedState = req.cookies.oauth_state;
    const deleteData = expectedState?.startsWith(deleteDataStatePrefix);
    const failurePath = deleteData ? `${deleteDataPath}?status=sign-in-failed` : "/";
    const cookies = [clearCookie("oauth_state", "/api/auth")];
    res.setHeader("Cache-Control", "no-store");
    if (deleteData) cookies.push(clearCookie(deleteDataCookie, deleteDataPath));

    const failure = error
        ? "Spotify authorization rejected"
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
        return res.redirect(302, failurePath);
    }

    const token = await requestToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback",
    }).catch(() => null);

    if (!token) {
        console.warn("Login failed: token exchange rejected");
        res.setHeader("Set-Cookie", cookies);
        return res.redirect(302, failurePath);
    }

    if (deleteData) {
        res.setHeader("Set-Cookie", [cookies[0], cookie(deleteDataCookie, token.access_token, deleteDataPath, Math.min(token.expires_in, 600))]);
        return res.redirect(302, deleteDataPath);
    }

    res.setHeader("Set-Cookie", [...cookies, ...tokenCookies(token)]);
    res.redirect(302, "/loading");
}
