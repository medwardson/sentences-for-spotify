import type { NextApiRequest, NextApiResponse } from "next";
import { clearCookie, requestToken, tokenCookies } from "../../../utils/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("Cache-Control", "no-store");

    const { access_token, refresh_token } = req.cookies;

    if (access_token) {
        return res.status(200).json({ accessToken: access_token });
    }

    if (!refresh_token) {
        return res.status(401).json({ error: "Not signed in" });
    }

    let token;
    try {
        token = await requestToken({ grant_type: "refresh_token", refresh_token });
    } catch {
        return res.status(401).json({ error: "Not signed in" });
    }

    if (!token) {
        res.setHeader("Set-Cookie", clearCookie("refresh_token", "/api/auth"));
        return res.status(401).json({ error: "Not signed in" });
    }

    res.setHeader("Set-Cookie", tokenCookies(token));
    res.status(200).json({ accessToken: token.access_token });
}
