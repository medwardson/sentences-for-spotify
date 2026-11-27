import { NextRequest, NextResponse } from "next/server";
import { clearCookie, clearWebsiteSessionCookies, deleteDataConfirmation, deleteDataCookie, deleteDataPath } from "@/utils/auth";
import { getSpotifyUser } from "@/utils/requireSpotifyUser";
import { deleteSpotifyMcpLinksForUser } from "@/utils/spotifyMcpOAuth";

export const maxDuration = 60;

function returnToForm(request: NextRequest, status: string) {
    const url = new URL(deleteDataPath, request.url);
    url.searchParams.set("status", status);
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
}

export async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
        return new Response(null, { status: 403 });
    }
    const token = request.cookies.get(deleteDataCookie)?.value;
    if (!token) return returnToForm(request, "sign-in-required");

    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
        return new Response(null, { status: 415 });
    }
    const form = new URLSearchParams(await request.text());
    if (form.get("confirmation") !== deleteDataConfirmation(token)) {
        return returnToForm(request, "review-again");
    }

    try {
        const account = await getSpotifyUser(token);
        if (!account) {
            const response = returnToForm(request, "sign-in-required");
            response.headers.append("Set-Cookie", clearCookie(deleteDataCookie, deleteDataPath));
            return response;
        }

        const { db } = await import("@/utils/firebaseAdmin");
        await deleteSpotifyMcpLinksForUser(account.id);
        await db.batch()
            .delete(db.collection("users").doc(account.id))
            .delete(db.collection("listening").doc(account.id))
            .commit();

        const response = returnToForm(request, "deleted");
        for (const cookie of [...clearWebsiteSessionCookies(), clearCookie(deleteDataCookie, deleteDataPath)]) {
            response.headers.append("Set-Cookie", cookie);
        }
        return response;
    } catch {
        console.error("Could not complete Spotify account data deletion");
        return returnToForm(request, "retry");
    }
}
