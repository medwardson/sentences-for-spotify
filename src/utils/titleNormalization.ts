/** Normalize sentence text and Spotify titles into comparable word sequences. */
export function normalizeTitle(text: string): string {
    return (
        text
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .replace(/[’‘ʼ]/g, "'")
            // Keep contractions and possessives as one word (winter’s -> winters).
            .replace(/(?<=[\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, "")
            .toLowerCase()
            .match(/[\p{L}\p{N}]+/gu)
            ?.join(" ") ?? ""
    );
}
