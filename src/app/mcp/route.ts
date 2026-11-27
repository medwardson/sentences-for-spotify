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
const playlistVisibilityNote = "Anyone with the link can open it. To restrict access, choose Make private in Spotify.";

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
                title: "Create a Spotify playlist",
                description: "Find Spotify tracks whose titles spell the requested sentence in order and save them as a new playlist in the linked account. The playlist stays off the owner's Spotify profile and out of search, and anyone with the link can open it. When the user asks for a private playlist, explain before creating it that they can select Make private in Spotify afterward. Use only when the user asks to create or save a playlist.",
                inputSchema: {
                    sentence: z.string().trim().min(1).max(160).describe("The sentence to spell with track titles."),
                    title: z.string().trim().min(1).max(100).describe("The name to save the playlist under in Spotify."),
                    mode: z.enum(Mode).default(Mode.SHORT).describe("Short prefers one title per word. Long tries longer titles first."),
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

                try {
                    const spotify = new SpotifyClient(accessToken);
                    const result = await spotify.createSentencePlaylist(sentence, title, mode, {
                        hideFromProfile: true,
                        searchSignal,
                    });
                    if (result.status === "failure") {
                        return {
                            content: [{ type: "text", text: "Spotify tracks could not spell the full sentence. No playlist was created." }],
                            structuredContent: { status: "no_match", title, sentence },
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Created the Spotify playlist ${title}: ${result.url}. ${playlistVisibilityNote}` }],
                        structuredContent: { status: "created", title, sentence, url: result.url, visibility: "link_accessible" },
                    };
                } catch (error) {
                    if (error instanceof SpotifyPlaylistSearchError) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: searchSignal.aborted
                                ? "Spotify track search timed out. No playlist was created. Try a shorter sentence."
                                : "Could not search Spotify for tracks. No playlist was created." }],
                        };
                    }
                    if (error instanceof SpotifyPlaylistTracksError) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: `Spotify created the playlist, but adding the tracks could not be confirmed. Check the existing playlist before trying again: ${error.playlistUrl}. ${playlistVisibilityNote}` }],
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
