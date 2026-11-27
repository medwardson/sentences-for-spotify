import type { NextApiRequest, NextApiResponse } from "next";
import { clearWebsiteSessionCookies } from "../../../utils/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    res.setHeader("Set-Cookie", clearWebsiteSessionCookies());
    res.status(204).end();
}
