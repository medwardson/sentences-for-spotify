import type { NextApiRequest, NextApiResponse } from "next";
import { clearCookie } from "../../../utils/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    res.setHeader("Set-Cookie", [
        clearCookie("access_token", "/"),
        clearCookie("refresh_token", "/api/auth"),
    ]);
    res.status(204).end();
}
