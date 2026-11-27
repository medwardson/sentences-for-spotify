import { Mode } from "@/types/query";
import { SearchResult, TrackObject } from "@/types/spotify";
import { addPlaylist } from "@/utils/database";
import { matchPlaylistTracks } from "@/utils/playlistMatcher";

const LONG_TITLE_RESULT_LIMIT = 50;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 512;

export class SpotifyPlaylistSearchError extends Error {
    constructor(cause: unknown) {
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
        options?: { visibility?: "private"; searchSignal?: AbortSignal }
    ): Promise<SearchResult> {
        let songUris: string[];
        try {
            options?.searchSignal?.throwIfAborted();
            songUris = await matchPlaylistTracks(sentence, mode, (name) =>
                this.findTrack(name, options?.searchSignal)
            );
            options?.searchSignal?.throwIfAborted();
        } catch (error) {
            if (!options?.searchSignal) throw error;
            throw new SpotifyPlaylistSearchError(error);
        }
        if (songUris.length === 0) {
            return { status: "failure", title, sentence };
        }

        const { playlistId, url } = await this.makePlaylist(title, options?.visibility);
        try {
            await this.addSongs(playlistId, songUris);
        } catch (error) {
            throw new SpotifyPlaylistTracksError(url, error);
        }
        return { status: "success", url, title, sentence };
    }

    private async findTrack(songName: string, signal?: AbortSignal): Promise<string | undefined> {
        const cached = this.searchCache.get(songName);
        if (cached && cached.expiresAt > Date.now()) return cached.uri;
        this.searchCache.delete(songName);

        const uri = await this.searchSong(songName, signal);
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

    private async searchSong(songName: string, signal?: AbortSignal): Promise<string | undefined> {
        const canSearchPastLimit = songName.split(" ").length <= 2;
        let url: string | null = this.url(songName);
        while (url) {
            const response = await fetch(url, { headers: this.headers, signal });
            if (!response.ok) {
                throw new Error(`Could not search Spotify tracks (${response.status})`);
            }

            const { tracks } = await response.json();
            const items: TrackObject[] = tracks.items;
            const match = items.find(
                (item) => item.name.toLowerCase() === songName
            );
            if (match) return match.uri;

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

    private async makePlaylist(title: string, visibility?: "private") {
        const response = await fetch("https://api.spotify.com/v1/me/playlists", {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                name: title,
                description: "Add a description for your playlist.",
                public: visibility === "private" ? false : undefined,
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
