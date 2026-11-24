import { SearchResult } from "@/types/spotify";

export const addPlaylist = async (accessToken: string, sr: SearchResult) => {
    await fetch("/api/addPlaylist", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(sr),
    });
};

export const sendData = async (accessToken: string) => {
    await fetchWithTimeout("/api/user", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
};

export const getPlaylistHistory = async (accessToken: string) => {
    const response = await fetchWithTimeout("/api/playlistHistory", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();
    return data.result as SearchResult[];
};

const fetchWithTimeout = async (
    path: string,
    options: RequestInit = {},
    timeout: number = 7500
) => {
    const controller = new AbortController();
    options.signal = controller.signal;

    try {
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(path, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return response;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.error("Fetch request timed out");
        } else {
            console.error("Fetch request failed", error);
        }
        throw error;
    }
};
