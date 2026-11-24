import type { NextApiRequest, NextApiResponse } from "next";

export interface SpotifyUser {
    id: string;
    display_name: string | null;
}

// null when Spotify rejects the token; throws on network failure
export async function getSpotifyUser(
    token: string
): Promise<SpotifyUser | null> {
    const spotifyRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!spotifyRes.ok) return null;
    const user = await spotifyRes.json();
    if (typeof user?.id !== "string" || user.id.length === 0) return null;
    return { id: user.id, display_name: user.display_name ?? null };
}

export async function requireSpotifyUser(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<SpotifyUser | null> {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) {
        res.status(401).json({ error: "Missing access token" });
        return null;
    }

    try {
        const user = await getSpotifyUser(token);
        if (!user) {
            res.status(401).json({ error: "Invalid access token" });
            return null;
        }
        return user;
    } catch (error) {
        console.error(
            "Failed to verify Spotify user:",
            (error as Error).message
        );
        res.status(502).json({ error: "Failed to verify Spotify user" });
        return null;
    }
}
