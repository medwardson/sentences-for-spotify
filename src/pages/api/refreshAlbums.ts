import type { NextApiRequest, NextApiResponse } from "next";
import AlbumGetter from "@/utils/albumGetter";
import { db } from "@/utils/firebaseAdmin";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "GET") {
        const cronSecret = process.env.CRON_SECRET;
        if (
            !cronSecret ||
            req.headers.authorization !== `Bearer ${cronSecret}`
        ) {
            res.status(401).end("Unauthorized");
            return;
        }

        const albumGetter = new AlbumGetter();
        await albumGetter.getToken();
        const albums = await albumGetter.getAlbums();

        if (!albums?.length) {
            res.status(502).end("Failed to fetch albums from Spotify");
            return;
        }

        await db
            .collection("albums")
            .doc("albums")
            .set({
                albums,
            });

        res.status(200).json({ albums });
    } else {
        res.setHeader("Allow", ["GET"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
