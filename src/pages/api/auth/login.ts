import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { cookie } from "../../../utils/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const state = randomBytes(16).toString("hex");

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: process.env.NEXT_PUBLIC_CLIENT_ID as string,
        scope: "playlist-modify-public",
        state,
        redirect_uri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback",
    }).toString();

    res.setHeader("Set-Cookie", cookie("oauth_state", state, "/api/auth", 600));
    res.redirect(302, authUrl.toString());
}
