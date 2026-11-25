import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebaseAdmin";

export const TIME_RANGES = ["short_term", "medium_term", "long_term"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export interface ListeningTrack {
    id: string;
    name: string;
    artists: string[];
    url: string;
    album: { name: string; releaseDate: string; image: string | null };
}

export interface ListeningArtist {
    id: string;
    name: string;
    url: string;
}

export interface RecentPlay {
    playedAt: string;
    trackId: string;
    name: string;
    artists: string[];
}

export interface Listening {
    fetchedAt: Timestamp;
    expireAt: Timestamp;
    topTracks: Record<TimeRange, ListeningTrack[]>;
    topArtists: Record<TimeRange, ListeningArtist[]>;
    recent: RecentPlay[];
}

export class SpotifyScopeError extends Error {
    constructor(path: string, status: number) {
        super(`Spotify ${path} returned ${status}`);
        this.name = "SpotifyScopeError";
    }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 7 * DAY_MS;
const EXPIRE_AFTER_MS = 30 * DAY_MS;

interface RawArtist {
    id: string;
    name: string;
    external_urls: { spotify: string };
}

interface RawTrack {
    id: string;
    name: string;
    artists: RawArtist[];
    external_urls: { spotify: string };
    album: {
        name: string;
        release_date: string;
        images: { url: string; width: number | null }[];
    };
}

interface RawPlay {
    played_at: string;
    track: RawTrack;
}

// the shelf share card draws covers 285px wide; Spotify serves 640, 300 and 64
const COVER_MIN_WIDTH = 285;

function coverUrl(images: RawTrack["album"]["images"]) {
    const bySize = [...images].sort(
        (a, b) => (a.width ?? 0) - (b.width ?? 0)
    );
    const cover =
        bySize.find((image) => (image.width ?? 0) >= COVER_MIN_WIDTH) ??
        bySize.at(-1);
    return cover?.url ?? null;
}

const slimTrack = (t: RawTrack): ListeningTrack => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    url: t.external_urls.spotify,
    album: {
        name: t.album.name,
        releaseDate: t.album.release_date,
        image: coverUrl(t.album.images),
    },
});

const slimArtist = (a: RawArtist): ListeningArtist => ({
    id: a.id,
    name: a.name,
    url: a.external_urls.spotify,
});

const slimPlay = (p: RawPlay): RecentPlay => ({
    playedAt: p.played_at,
    trackId: p.track.id,
    name: p.track.name,
    artists: p.track.artists.map((a) => a.name),
});

async function spotifyGet<T>(
    accessToken: string,
    path: string
): Promise<{ items: T[] }> {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401 || res.status === 403) {
        throw new SpotifyScopeError(path, res.status);
    }
    if (!res.ok) throw new Error(`Spotify ${path} returned ${res.status}`);
    return res.json();
}

async function fetchListening(accessToken: string): Promise<Listening> {
    const top = <R>(type: "tracks" | "artists") =>
        Promise.all(
            TIME_RANGES.map((range) =>
                spotifyGet<R>(
                    accessToken,
                    `/me/top/${type}?time_range=${range}&limit=50`
                )
            )
        );
    const [tracks, artists, recent] = await Promise.all([
        top<RawTrack>("tracks"),
        top<RawArtist>("artists"),
        spotifyGet<RawPlay>(accessToken, "/me/player/recently-played?limit=50"),
    ]);

    const byRange = <R, T>(pages: { items: R[] }[], slim: (item: R) => T) =>
        Object.fromEntries(
            TIME_RANGES.map((range, i) => [range, pages[i].items.map(slim)])
        ) as Record<TimeRange, T[]>;

    const now = Date.now();
    return {
        fetchedAt: Timestamp.fromMillis(now),
        expireAt: Timestamp.fromMillis(now + EXPIRE_AFTER_MS),
        topTracks: byRange(tracks, slimTrack),
        topArtists: byRange(artists, slimArtist),
        recent: recent.items.map(slimPlay),
    };
}

const refreshes = new Map<string, Promise<Listening>>();

export async function getListening(
    accessToken: string,
    userId: string
): Promise<Listening> {
    const ref = db.collection("listening").doc(userId);
    const cached = (await ref.get()).data() as Listening | undefined;
    if (cached && Date.now() - cached.fetchedAt.toMillis() < STALE_AFTER_MS) {
        return cached;
    }

    let refresh = refreshes.get(userId);
    if (!refresh) {
        refresh = fetchListening(accessToken)
            .then(async (listening) => {
                await ref.set(listening);
                return listening;
            })
            .finally(() => refreshes.delete(userId));
        refreshes.set(userId, refresh);
    }
    return refresh;
}
