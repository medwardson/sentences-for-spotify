import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../utils/firebaseAdmin";
import { requireSpotifyUser } from "../../utils/requireSpotifyUser";

const isString = (value: unknown, max: number): value is string =>
    typeof value === "string" && value.length <= max;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "POST") {
        const user = await requireSpotifyUser(req, res);
        if (!user) return;

        const { url, title, sentence = "" } = req.body ?? {};
        if (
            !isString(title, 200) ||
            !isString(sentence, 1000) ||
            !isString(url, 500) ||
            !url.startsWith("https://open.spotify.com/")
        ) {
            return res.status(400).json({ error: "Invalid playlist" });
        }
        const userRef = db.collection("users").doc(user.id);

        try {
            await userRef.update({
                searchHistory: FieldValue.arrayUnion({
                    title,
                    url,
                    sentence,
                }),
            });

            res.status(200).json({ message: "Playlist added successfully" });
        } catch (error: any) {
            if (error.code === "not-found") {
                await userRef.set({
                    searchHistory: [{ title, url, sentence }],
                });
                return res
                    .status(200)
                    .json({ message: "Playlist added and user created" });
            }
            console.error("Failed to add playlist:", error);
            res.status(500).json({ error: "Failed to add playlist" });
        }
    } else {
        res.setHeader("Allow", ["POST"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
