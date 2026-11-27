import { Mode } from "@/types/query";

type FindTrack = (normalizedTitle: string) => Promise<string | undefined>;

export async function matchPlaylistTracks(
    sentence: string,
    mode: Mode,
    findTrack: FindTrack
): Promise<string[]> {
    const words = sentence
        .split(" ")
        .map((word) => word.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
        .filter(Boolean);
    const lookups = new Map<string, ReturnType<FindTrack>>();

    const lookup: FindTrack = (title) => {
        const pending = lookups.get(title);
        if (pending) return pending;

        const result = findTrack(title);
        lookups.set(title, result);
        return result;
    };

    return mode === Mode.LONG
        ? matchLongTitles(words, lookup)
        : matchShortTitles(words, lookup);
}

async function matchShortTitles(
    words: string[],
    lookup: FindTrack
): Promise<string[]> {
    if (words.length === 0) return [];
    if (words.length === 1) {
        const track = await lookup(words[0]);
        return track ? [track] : [];
    }

    const middle = Math.floor(words.length / 2);
    const [first, second] = await Promise.all([
        matchShortTitles(words.slice(0, middle), lookup),
        matchShortTitles(words.slice(middle), lookup),
    ]);
    if (first.length + second.length === words.length) {
        return [...first, ...second];
    }

    return matchLongTitles(words, lookup);
}

async function matchLongTitles(
    words: string[],
    lookup: FindTrack
): Promise<string[]> {
    const unmatched = new Set<number>();
    const tracks: string[] = [];

    async function matchFrom(start: number): Promise<boolean> {
        if (start === words.length) return true;

        for (let end = words.length; end > start; end--) {
            // No title ending here can complete a suffix that already failed.
            if (unmatched.has(end)) continue;

            const track = await lookup(words.slice(start, end).join(" "));
            if (!track) continue;

            if (await matchFrom(end)) {
                tracks.push(track);
                return true;
            }
        }

        unmatched.add(start);
        return false;
    }

    await matchFrom(0);
    return tracks.reverse();
}
