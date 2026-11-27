import {
    authorizeSpotifyMcp,
    exchangeSpotifyMcpToken,
    finishSpotifyMcp,
    spotifyMcpConfig,
} from "@/utils/spotifyMcpOAuth";

type Context = { params: Promise<{ action: string }> };

export async function GET(request: Request, { params }: Context) {
    const config = spotifyMcpConfig();
    const { action } = await params;
    if (config && action === "authorize") return authorizeSpotifyMcp(request, config);
    if (config && action === "callback") return finishSpotifyMcp(request, config);
    return new Response(null, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
    const config = spotifyMcpConfig();
    const { action } = await params;
    if (config && action === "token") return exchangeSpotifyMcpToken(request, config);
    return new Response(null, { status: 404 });
}
