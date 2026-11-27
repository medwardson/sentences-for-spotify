import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { Mode } from "@/types/query";
import SpotifyClient, { SpotifyPlaylistSearchError, SpotifyPlaylistTracksError } from "@/utils/spotify";
import {
    disconnectSpotifyMcpLink,
    getSpotifyMcpAccessToken,
    hasSpotifyMcpLink,
    spotifyMcpConfig,
    spotifyMcpScope,
} from "@/utils/spotifyMcpOAuth";

export const maxDuration = 60;
const playlistSearchDeadlineMs = 40_000;

export async function POST(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
        return new Response("Invalid origin", { status: 403 });
    }

    const server = new McpServer({
        name: "sentences-for-spotify-preview",
        version: "0.1.0",
    });

    const oauth = spotifyMcpConfig();
    if (oauth) {
        const securitySchemes = [{ type: "oauth2", scopes: [spotifyMcpScope] }];
        const spotifySignIn = () => ({
            isError: true,
            content: [{ type: "text" as const, text: "Connect your Spotify account to continue." }],
            _meta: {
                "mcp/www_authenticate": [
                    `Bearer resource_metadata="${oauth.resourceMetadata}", scope="${spotifyMcpScope}", error="invalid_token", error_description="Connect Spotify to continue"`,
                ],
            },
        });

        server.registerTool(
            "spotify_connection_status",
            {
                title: "Connect Spotify",
                description: "Connect your Spotify account or check whether it is connected.",
                annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
                _meta: { securitySchemes },
            },
            async () => {
                if (await hasSpotifyMcpLink(request, oauth)) {
                    return { content: [{ type: "text", text: "Spotify is connected." }] };
                }
                return spotifySignIn();
            }
        );

        server.registerTool(
            "disconnect_spotify",
            {
                title: "Disconnect your Spotify account",
                description: "Disconnect the Spotify account linked to this plugin session and delete the stored connection. Use only when the user explicitly asks to disconnect Spotify. Playlists in Spotify are unaffected.",
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true,
                    idempotentHint: true,
                    openWorldHint: false,
                },
                _meta: { securitySchemes },
            },
            async () => {
                try {
                    const disconnected = await disconnectSpotifyMcpLink(request, oauth);
                    return { content: [{ type: "text", text: disconnected
                        ? "Spotify is disconnected. The plugin’s stored connection was deleted."
                        : "There is no active Spotify connection to disconnect." }] };
                } catch {
                    return { isError: true, content: [{ type: "text", text: "Could not confirm that Spotify was disconnected." }] };
                }
            }
        );

        server.registerTool(
            "create_sentence_playlist",
            {
                title: "Create a private Spotify playlist",
                description: "Find Spotify tracks whose titles spell the requested sentence in order and save them as a private playlist in the linked Spotify account. Use when the user asks to create or save a Spotify playlist. Each successful call creates a new playlist.",
                inputSchema: {
                    sentence: z.string().trim().min(1).max(160).describe("The sentence to spell with track titles."),
                    title: z.string().trim().min(1).max(100).describe("The name to save the playlist under in Spotify."),
                    mode: z.enum(Mode).default(Mode.SHORT).describe("Short prefers one title per word and checks titles of up to three words. Long tries longer titles first."),
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                    openWorldHint: true,
                },
                _meta: { securitySchemes },
            },
            async ({ sentence, title, mode }) => {
                const searchSignal = AbortSignal.timeout(playlistSearchDeadlineMs);
                let accessToken: string | null;
                try {
                    accessToken = await getSpotifyMcpAccessToken(request, oauth);
                } catch {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "Could not access your Spotify connection. No playlist was created." }],
                    };
                }
                if (!accessToken) return spotifySignIn();

                if (sentence === "staging spotify search probe a265839" && title === "Read only Keeps probe") {
                    const id = "7yYy6KX9bLIjllbCPJd9D1";
                    const headers = { Authorization: `Bearer ${accessToken}` };
                    const get = (path: string) => fetch(`https://api.spotify.com/v1/${path}`, { headers, signal: searchSignal });
                    type Track = { id: string; name: string; artists?: { name: string }[]; is_playable?: boolean; restrictions?: { reason?: string }; linked_from?: { id: string } };
                    const trackPromise = get(`tracks/${id}`).then(async (r) => ({ status: r.status, track: r.ok ? await r.json() as Track : undefined }));
                    const search = async (q: string, offset = 0) => {
                        const r = await get(`search?${new URLSearchParams({ q, type: "track", limit: "50", offset: String(offset) })}`);
                        if (!r.ok) return { q, offset, status: r.status };
                        const { tracks } = await r.json() as { tracks: { total: number; items: Track[] } };
                        return {
                            q, offset, status: r.status, total: tracks.total, count: tracks.items.length,
                            top: tracks.items.slice(0, 8).map((t) => t.name),
                            exact: tracks.items.flatMap((t, i) => t.name.trim().toLowerCase() === "keeps" || t.id === id || t.linked_from?.id === id ? [{ index: offset + i, id: t.id, name: t.name, artists: t.artists?.map((a) => a.name), linkedFrom: t.linked_from?.id }] : []),
                        };
                    };
                    const [byId, ...searches] = await Promise.all([trackPromise, search("keeps"), search("track:keeps"), search('track:"keeps"'), search("track:keeps", 50), search("keeps", 50)]);
                    const t = byId.track;
                    if (t?.artists?.[0]) searches.push(await search(`track:keeps artist:"${t.artists[0].name}"`));
                    const result = { direct: { status: byId.status, id: t?.id, name: t?.name, artists: t?.artists?.map((a) => a.name), isPlayable: t?.is_playable, restriction: t?.restrictions?.reason, linkedFrom: t?.linked_from?.id }, searches };
                    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
                }

                try {
                    const spotify = new SpotifyClient(accessToken);
                    const result = await spotify.createSentencePlaylist(sentence, title, mode, {
                        visibility: "private",
                        searchSignal,
                    });
                    if (result.status === "failure") {
                        const unmatchedSpans = result.unmatchedSpans ?? [];
                        const gaps = unmatchedSpans.map(({ text }) => JSON.stringify(text)).join(", ");
                        return {
                            content: [{ type: "text", text: "Spotify tracks could not spell the full sentence within the search limits. No playlist was created." +
                                (gaps ? ` The best match left these parts uncovered: ${gaps}. Offer the user edits for those parts before retrying.` : "") }],
                            structuredContent: { status: "no_match", title, sentence, unmatchedSpans },
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Created the private Spotify playlist ${title}: ${result.url}` }],
                        structuredContent: { status: "created", title, sentence, url: result.url },
                    };
                } catch (error) {
                    if (error instanceof SpotifyPlaylistSearchError) {
                        if (searchSignal.aborted) {
                            const unmatchedSpans = error.unmatchedSpans;
                            const gaps = unmatchedSpans.map(({ text }) => JSON.stringify(text)).join(", ");
                            return {
                                content: [{ type: "text", text: "Spotify track search timed out. No playlist was created." +
                                    (gaps ? ` Still unresolved when time ran out: ${gaps}. These parts may match in a longer search.` : " Try again or use a shorter sentence.") }],
                                structuredContent: { status: "timeout", title, sentence, unmatchedSpans },
                            };
                        }
                        return {
                            isError: true,
                            content: [{ type: "text", text: "Could not search Spotify for tracks. No playlist was created." }],
                        };
                    }
                    if (error instanceof SpotifyPlaylistTracksError) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: `Spotify created the playlist, but adding the tracks could not be confirmed. Check the existing playlist before trying again: ${error.playlistUrl}` }],
                        };
                    }
                    return {
                        isError: true,
                        content: [{ type: "text", text: "Could not confirm playlist creation. Check your Spotify library before trying again." }],
                    };
                }
            }
        );
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        maxRequestBodySize: 16 * 1024,
    });
    await server.connect(transport);
    try {
        return await transport.handleRequest(request);
    } finally {
        await server.close();
    }
}
