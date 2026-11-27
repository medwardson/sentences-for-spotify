import { Mode } from "@/types/query";
import { SearchResult, TrackObject, UnmatchedSpan } from "@/types/spotify";
import { addPlaylist } from "@/utils/database";
import { findUnmatchedSpans, matchPlaylistTracks } from "@/utils/playlistMatcher";
import { normalizeTitle } from "@/utils/titleNormalization";

const LONG_TITLE_RESULT_LIMIT = 50;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 512;

type SearchPhaseMetrics = {
    startedAt?: number;
    elapsedMs: number;
    lookups: number;
    requests: number;
};

function searchPhaseMetrics(): SearchPhaseMetrics {
    return { elapsedMs: 0, lookups: 0, requests: 0 };
}

export class SpotifyPlaylistSearchError extends Error {
    constructor(cause: unknown, readonly unmatchedSpans: UnmatchedSpan[] = []) {
        super("Could not finish searching Spotify for playlist tracks", { cause });
    }
}

export class SpotifyPlaylistTracksError extends Error {
    constructor(readonly playlistUrl: string, cause: unknown) {
        super("Spotify playlist was created but adding tracks could not be confirmed", { cause });
    }
}

class SpotifyClient {
    private headers: HeadersInit;
    private readonly searchCache = new Map<string, {
        uri: string | undefined;
        expiresAt: number;
    }>();

    constructor(private accessToken: string) {
        this.headers = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };
    }

    private url(name: string) {
        return `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=track&limit=50`;
    }

    async startCreationAttempt(
        sentence: string,
        title: string,
        mode: Mode
    ): Promise<SearchResult> {
        const result = await this.createSentencePlaylist(sentence, title, mode);
        if (result.status === "success") addPlaylist(this.accessToken, result);
        return result;
    }

    async createSentencePlaylist(
        sentence: string,
        title: string,
        mode: Mode,
        options?: { hideFromProfile?: boolean; searchSignal?: AbortSignal }
    ): Promise<SearchResult> {
        const startedAt = Date.now();
        const firstPage = searchPhaseMetrics();
        const fallback = searchPhaseMetrics();
        const matchedTitles = new Set<string>();
        let outcome = "error";
        let songUris: string[];
        try {
            options?.searchSignal?.throwIfAborted();
            songUris = await matchPlaylistTracks(sentence, mode, async (name, firstPageOnly) => {
                const phase = firstPageOnly ? firstPage : fallback;
                phase.startedAt ??= Date.now();
                phase.lookups++;
                try {
                    const track = await this.findTrack(name, options?.searchSignal, firstPageOnly, phase);
                    if (track) matchedTitles.add(name);
                    return track;
                } finally {
                    phase.elapsedMs = Date.now() - phase.startedAt;
                }
            });
            options?.searchSignal?.throwIfAborted();
            outcome = songUris.length > 0 ? "matched" : "no_match";
        } catch (error) {
            if (!options?.searchSignal) throw error;
            if (options.searchSignal.aborted) outcome = "aborted";
            throw new SpotifyPlaylistSearchError(error, findUnmatchedSpans(sentence, matchedTitles));
        } finally {
            if (options?.searchSignal) {
                const summarize = ({ elapsedMs, lookups, requests }: SearchPhaseMetrics) =>
                    ({ elapsedMs, lookups, requests });
                console.info("spotify_playlist_search", JSON.stringify({
                    mode, outcome, elapsedMs: Date.now() - startedAt,
                    firstPage: summarize(firstPage), fallback: summarize(fallback),
                }));
            }
        }
        if (songUris.length === 0) {
            return { status: "failure", title, sentence, unmatchedSpans: findUnmatchedSpans(sentence, matchedTitles) };
        }

        const { playlistId, url } = await this.makePlaylist(title, options?.hideFromProfile);
        try {
            await this.addSongs(playlistId, songUris);
        } catch (error) {
            throw new SpotifyPlaylistTracksError(url, error);
        }
        return { status: "success", url, title, sentence };
    }

    private async findTrack(songName: string, signal: AbortSignal | undefined, firstPageOnly: boolean | undefined, phase: SearchPhaseMetrics): Promise<string | undefined> {
        const cached = this.searchCache.get(songName);
        if (cached && cached.expiresAt > Date.now()) return cached.uri;
        this.searchCache.delete(songName);

        const uri = await this.searchSong(songName, signal, firstPageOnly, phase);
        // A miss on the first page is not a miss for the full search.
        if (firstPageOnly && !uri) return undefined;
        this.searchCache.set(songName, {
            uri,
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        });
        if (this.searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
            const oldest = this.searchCache.keys().next();
            if (!oldest.done) this.searchCache.delete(oldest.value);
        }
        return uri;
    }

    private async searchSong(songName: string, signal: AbortSignal | undefined, firstPageOnly: boolean | undefined, phase: SearchPhaseMetrics): Promise<string | undefined> {
        const canSearchPastLimit = songName.split(" ").length <= 2;
        let url: string | null = this.url(songName);
        while (url) {
            signal?.throwIfAborted();
            phase.requests++;
            const response = await fetch(url, { headers: this.headers, signal });
            if (!response.ok) {
                throw new Error(`Could not search Spotify tracks (${response.status})`);
            }

            const { tracks } = await response.json();
            const items: TrackObject[] = tracks.items;
            const match = items.find(
                (item) => normalizeTitle(item.name) === songName
            );
            if (match) return match.uri;
            if (firstPageOnly) return undefined;

            if (
                !canSearchPastLimit &&
                tracks.offset + items.length >= LONG_TITLE_RESULT_LIMIT
            ) {
                return undefined;
            }
            url = tracks.next;
        }
        return undefined;
    }

    private async makePlaylist(title: string, hideFromProfile?: boolean) {
        const response = await fetch("https://api.spotify.com/v1/me/playlists", {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                name: title,
                description: "Add a description for your playlist.",
                public: hideFromProfile ? false : undefined,
            }),
        });
        if (!response.ok) {
            throw new Error(`Could not create Spotify playlist (${response.status})`);
        }
        const data = await response.json();
        return { playlistId: data.id, url: data.external_urls.spotify };
    }

    private async addSongs(playlistId: string, songUris: string[]) {
        // Spotify takes at most 100 items per request; sequential keeps the order
        for (let i = 0; i < songUris.length; i += 100) {
            const response = await fetch(
                `https://api.spotify.com/v1/playlists/${playlistId}/items`,
                {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify({
                        uris: songUris.slice(i, i + 100),
                    }),
                }
            );
            if (!response.ok) {
                throw new Error(`Could not add tracks to Spotify playlist (${response.status})`);
            }
        }
    }
}

export default SpotifyClient;
