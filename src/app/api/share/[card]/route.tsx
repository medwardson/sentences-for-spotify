import { NextRequest, NextResponse } from "next/server";
import { CARDS, Card, renderCard } from "@/app/api/share/cards";
import {
    SpotifyScopeError,
    TIME_RANGES,
    TimeRange,
    getListening,
} from "@/utils/listening";
import { getSpotifyUser } from "@/utils/requireSpotifyUser";

export const runtime = "nodejs";

const isCard = (card: string): card is Card =>
    (CARDS as readonly string[]).includes(card);
const isRange = (range: string | null): range is TimeRange =>
    (TIME_RANGES as readonly (string | null)[]).includes(range);

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
        user = await getSpotifyUser(token);
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

    const rangeParam = request.nextUrl.searchParams.get("range");
    const range: TimeRange = isRange(rangeParam) ? rangeParam : "short_term";
    const cardRange = card === "eras" ? "long_term" : range;

    const image = await renderCard(
        card,
        listening.topTracks[cardRange],
        cardRange
    );
    if (!image) {
        return NextResponse.json(
            { error: "Not enough listening history" },
            { status: 422 }
        );
    }
    image.headers.set("cache-control", "private, max-age=300");
    return image;
}
