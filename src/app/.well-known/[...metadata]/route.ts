import { spotifyMcpConfig, spotifyMcpMetadata } from "@/utils/spotifyMcpOAuth";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ metadata: string[] }> }
) {
    const config = spotifyMcpConfig();
    const { metadata } = await params;
    const [kind, resource] = metadata;
    if (!config || (metadata.length > 1 && (
        metadata.length !== 2 || kind !== "oauth-protected-resource" || resource !== "mcp"
    ))) return new Response(null, { status: 404 });

    return spotifyMcpMetadata(config, kind);
}
