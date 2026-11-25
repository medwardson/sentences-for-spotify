import { NextRequest, NextResponse } from "next/server";
import { CARDS, Card, renderCard } from "@/app/api/share/cards";
import {
    SpotifyScopeError,
    TIME_RANGES,
    TimeRange,
    getListening,
} from "@/utils/listening";
import { SpotifyUser, getSpotifyUser } from "@/utils/requireSpotifyUser";

export const runtime = "nodejs";

const isCard = (card: string): card is Card =>
    (CARDS as readonly string[]).includes(card);
const isRange = (range: string | null): range is TimeRange =>
    (TIME_RANGES as readonly (string | null)[]).includes(range);

const USER_TTL_MS = 5 * 60 * 1000;
const MAX_USERS = 500;
const users = new Map<string, { user: SpotifyUser; expires: number }>();

// the Stats page requests every card at once, so verify each token with Spotify once per TTL
async function verifiedUser(token: string) {
    const cached = users.get(token);
    if (cached && cached.expires > Date.now()) return cached.user;
    users.delete(token);

    const user = await getSpotifyUser(token);
    if (user) {
        users.set(token, { user, expires: Date.now() + USER_TTL_MS });
        // a Map iterates in insertion order, so the first key is the oldest
        if (users.size > MAX_USERS) users.delete(users.keys().next().value!);
    }
    return user;
}

function validTimeZone(timeZone: string | null) {
    if (!timeZone) return "UTC";
    try {
        new Intl.DateTimeFormat("en-US", { timeZone });
        return timeZone;
    } catch {
        return "UTC";
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ card: string }> }
) {
    const { card } = await params;
    if (!isCard(card)) {
        return NextResponse.json({ error: "Unknown card" }, { status: 404 });
    }

    const token = request.cookies.get("access_token")?.value;
    if (!token) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    let user;
    try {
        user = await verifiedUser(token);
    } catch (error) {
        console.error(
            "Failed to verify Spotify user:",
            (error as Error).message
        );
        return NextResponse.json(
            { error: "Failed to verify Spotify user" },
            { status: 502 }
        );
    }
    if (!user) {
        return NextResponse.json(
            { error: "Invalid access token" },
            { status: 401 }
        );
    }

    let listening;
    try {
        listening = await getListening(token, user.id);
    } catch (error) {
        if (error instanceof SpotifyScopeError) {
            return NextResponse.json({ error: "reconnect" }, { status: 403 });
        }
        throw error;
    }

    const { searchParams } = request.nextUrl;
    const rangeParam = searchParams.get("range");
    const image = await renderCard(card, listening, {
        range: isRange(rangeParam) ? rangeParam : "short_term",
        timeZone: validTimeZone(searchParams.get("tz")),
    });
    if (!image) {
        return NextResponse.json(
            { error: "Not enough listening history" },
            { status: 422 }
        );
    }
    image.headers.set("cache-control", "private, max-age=300");
    return image;
}
