import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { clearCookie, cookie, requestToken } from "@/utils/auth";
import { getSpotifyUser } from "@/utils/requireSpotifyUser";

export const spotifyMcpScope = "spotify:link";
const stateCookie = "mcp_spotify_oauth_state";
const oauthPath = "/api/mcp/oauth";
const accessLifetime = 60 * 60;
const linkLifetime = 30 * 24 * 60 * 60;

export function spotifyMcpConfig() {
    const origin = process.env.MCP_OAUTH_ORIGIN;
    const clientId = process.env.MCP_OAUTH_CLIENT_ID;
    const redirectUri = process.env.MCP_OAUTH_REDIRECT_URI;
    const key = Buffer.from(process.env.MCP_SPOTIFY_TOKEN_KEY ?? "", "base64");
    if (!origin || !clientId || !redirectUri || key.length !== 32) {
        return null;
    }
    try {
        const issuer = new URL(origin);
        const redirect = new URL(redirectUri);
        if (issuer.protocol !== "https:" || issuer.origin !== origin ||
            redirect.origin !== "https://chatgpt.com" || redirect.hash) return null;
    } catch {
        return null;
    }
    return {
        origin, clientId, redirectUri, key,
        resource: origin + "/mcp",
        resourceMetadata: origin + "/.well-known/oauth-protected-resource",
        callback: origin + oauthPath + "/callback",
    };
}

type Config = NonNullable<ReturnType<typeof spotifyMcpConfig>>;
type PendingLink = { expiresAt: Date; challenge: string; clientState: string; resource: string };
type Code = { expiresAt: Date; challenge: string; linkId: string };
type Grant = { expiresAt: Date; linkId: string; resource: string };

const randomToken = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
const expires = (seconds: number) => new Date(Date.now() + seconds * 1000);
const json = (value: object, status = 200) =>
    new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
const oauthError = (error: string, status = 400) => json({ error }, status);

function redirect(url: URL, setCookie?: string) {
    const headers = new Headers({ Location: url.href, "Cache-Control": "no-store" });
    if (setCookie) {
        headers.set("Set-Cookie", process.env.NODE_ENV === "production"
            ? setCookie : setCookie + "; Secure");
    }
    return new Response(null, { status: 302, headers });
}

async function store() {
    const { db } = await import("@/utils/firebaseAdmin");
    const links = db.collection("mcpSpotifyLinks");
    const secrets = db.collection("mcpSpotifyOAuth");
    return { db, links, secret: (kind: string, token: string) =>
        secrets.doc(kind + "_" + hash(token)) };
}

export function spotifyMcpMetadata(config: Config, kind: string) {
    if (kind === "oauth-protected-resource") {
        return json({
            resource: config.resource,
            authorization_servers: [config.origin],
            scopes_supported: [spotifyMcpScope],
            bearer_methods_supported: ["header"],
        });
    }
    if (kind !== "oauth-authorization-server") return new Response(null, { status: 404 });
    return json({
        issuer: config.origin,
        authorization_endpoint: config.origin + oauthPath + "/authorize",
        token_endpoint: config.origin + oauthPath + "/token",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        authorization_response_iss_parameter_supported: true,
        scopes_supported: [spotifyMcpScope],
    });
}

export async function authorizeSpotifyMcp(request: Request, config: Config) {
    const params = new URL(request.url).searchParams;
    if (params.get("client_id") !== config.clientId ||
        params.get("redirect_uri") !== config.redirectUri) {
        return oauthError("invalid_request");
    }

    const clientState = params.get("state");
    const challenge = params.get("code_challenge");
    if (!clientState || clientState.length > 1024 ||
        !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
        params.get("response_type") !== "code" ||
        params.get("code_challenge_method") !== "S256" ||
        params.get("scope") !== spotifyMcpScope ||
        params.get("resource") !== config.resource) {
        return oauthError("invalid_request");
    }

    const state = randomToken();
    const { secret } = await store();
    const pending: PendingLink = {
        challenge, clientState, resource: config.resource, expiresAt: expires(600),
    };
    await secret("state", state).create(pending);
    const spotify = new URL("https://accounts.spotify.com/authorize");
    spotify.search = new URLSearchParams({
        response_type: "code",
        client_id: process.env.NEXT_PUBLIC_CLIENT_ID ?? "",
        redirect_uri: config.callback,
        scope: "playlist-modify-private",
        state,
    }).toString();
    return redirect(spotify, cookie(stateCookie, state, oauthPath, 600));
}

export async function finishSpotifyMcp(request: Request, config: Config) {
    const params = new URL(request.url).searchParams;
    const state = params.get("state");
    const stateInCookie = request.headers.get("cookie")?.split(/;\s*/)
        .find((part) => part.startsWith(stateCookie + "="))?.slice(stateCookie.length + 1);
    if (!state || state !== stateInCookie || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
        return oauthError("invalid_request");
    }

    const { db, links, secret } = await store();
    const stateRef = secret("state", state);
    const pending = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateRef);
        if (!snapshot.exists || snapshot.get("expiresAt").toMillis() <= Date.now() ||
            snapshot.get("resource") !== config.resource) return null;
        transaction.delete(stateRef);
        return { challenge: snapshot.get("challenge"), clientState: snapshot.get("clientState") };
    });
    if (!pending) return oauthError("invalid_request");

    const destination = new URL(config.redirectUri);
    destination.searchParams.set("state", pending.clientState);
    destination.searchParams.set("iss", config.origin);
    const clear = clearCookie(stateCookie, oauthPath);
    const spotifyCode = params.get("code");
    if (params.has("error") || !spotifyCode) {
        destination.searchParams.set("error", "access_denied");
        return redirect(destination, clear);
    }

    try {
        const tokens = await requestToken({
            grant_type: "authorization_code",
            code: spotifyCode,
            redirect_uri: config.callback,
        });
        const user = tokens && await getSpotifyUser(tokens.access_token);
        if (!tokens?.refresh_token || !user) {
            destination.searchParams.set("error", "access_denied");
            return redirect(destination, clear);
        }

        const nonce = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", config.key, nonce);
        const link = links.doc();
        cipher.setAAD(Buffer.from(link.id));
        const encrypted = Buffer.concat([cipher.update(tokens.refresh_token, "utf8"), cipher.final()]);
        const code = randomToken();
        await db.batch()
            .create(link, {
                spotifyUserId: user.id,
                resource: config.resource,
                spotifyRefreshToken: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url"),
                expiresAt: expires(linkLifetime),
            })
            .create(secret("code", code), {
                challenge: pending.challenge, linkId: link.id, expiresAt: expires(300),
            } satisfies Code)
            .commit();
        destination.searchParams.set("code", code);
    } catch {
        destination.searchParams.set("error", "server_error");
    }
    return redirect(destination, clear);
}

export async function exchangeSpotifyMcpToken(request: Request, config: Config) {
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
        return oauthError("invalid_request");
    }
    const body = await request.text();
    if (body.length > 8192) return oauthError("invalid_request");
    const params = new URLSearchParams(body);
    if (params.get("client_id") !== config.clientId) return oauthError("invalid_client");
    const type = params.get("grant_type");
    if (type !== "authorization_code" && type !== "refresh_token") {
        return oauthError("unsupported_grant_type");
    }
    const isCode = type === "authorization_code";
    if ((isCode || params.has("resource")) && params.get("resource") !== config.resource) {
        return oauthError("invalid_target");
    }
    if (params.has("scope") && params.get("scope") !== spotifyMcpScope) {
        return oauthError("invalid_scope");
    }

    const presented = params.get(isCode ? "code" : "refresh_token");
    const verifier = params.get("code_verifier") ?? "";
    if (!presented || !/^[A-Za-z0-9_-]{43}$/.test(presented) ||
        (isCode && (params.get("redirect_uri") !== config.redirectUri ||
            !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)))) {
        return oauthError("invalid_grant");
    }

    const { db, links, secret } = await store();
    const grantRef = secret(isCode ? "code" : "refresh", presented);
    const access = randomToken();
    const refresh = randomToken();
    const issued = await db.runTransaction(async (transaction) => {
        const grant = await transaction.get(grantRef);
        if (!grant.exists || grant.get("expiresAt").toMillis() <= Date.now() ||
            (isCode && grant.get("challenge") !== hash(verifier))) return false;
        const linkId: string = grant.get("linkId");
        const link = await transaction.get(links.doc(linkId));
        if (!link.exists || link.get("expiresAt").toMillis() <= Date.now() ||
            link.get("resource") !== config.resource) return false;

        transaction.delete(grantRef);
        transaction.create(secret("access", access), {
            linkId, resource: config.resource, expiresAt: expires(accessLifetime),
        } satisfies Grant);
        transaction.create(secret("refresh", refresh), {
            linkId, resource: config.resource, expiresAt: link.get("expiresAt").toDate(),
        } satisfies Grant);
        return true;
    });
    return issued ? json({
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: accessLifetime,
        scope: spotifyMcpScope,
    }) : oauthError("invalid_grant");
}

export async function hasSpotifyMcpLink(request: Request, config: Config) {
    const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
    if (!token) return false;

    const { links, secret } = await store();
    const grant = await secret("access", token).get();
    if (!grant.exists || grant.get("expiresAt").toMillis() <= Date.now() ||
        grant.get("resource") !== config.resource) return false;
    const link = await links.doc(grant.get("linkId")).get();
    return link.exists && link.get("expiresAt").toMillis() > Date.now()
        && link.get("resource") === config.resource;
}
