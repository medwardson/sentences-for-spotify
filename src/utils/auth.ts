import { createHash } from "node:crypto";

export const deleteDataPath = "/delete-data";
export const deleteDataCookie = "delete_data_access_token";
export const deleteDataStatePrefix = "delete-data.";

export function deleteDataConfirmation(token: string) {
    return createHash("sha256").update(token).digest("base64url");
}

export const cookie = (
    name: string,
    value: string,
    path: string,
    maxAge: number
) =>
    `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`;

export const clearCookie = (name: string, path: string) =>
    cookie(name, "", path, 0);

export const clearWebsiteSessionCookies = () => [
    clearCookie("access_token", "/"),
    clearCookie("refresh_token", "/api/auth"),
];

export const requestToken = async (
    params: Record<string, string>,
    throwOnUnexpectedError = false
) => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(
                `${process.env.NEXT_PUBLIC_CLIENT_ID}:${process.env.NEXT_CLIENT_SECRET}`
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
    });
    if (!response.ok) {
        if (throwOnUnexpectedError) {
            const body = await response.json().catch(() => null);
            if (body?.error !== "invalid_grant") {
                throw new Error(`Spotify token request failed (${response.status})`);
            }
        }
        return null;
    }

    return (await response.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
    };
};

export const tokenCookies = (token: {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
}) => {
    const cookies = [
        cookie("access_token", token.access_token, "/", token.expires_in),
    ];
    if (token.refresh_token) {
        cookies.push(
            cookie(
                "refresh_token",
                token.refresh_token,
                "/api/auth",
                60 * 60 * 24 * 30
            )
        );
    }
    return cookies;
};
