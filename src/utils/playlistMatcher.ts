import { Mode } from "@/types/query";
import type { UnmatchedSpan } from "@/types/spotify";
import { normalizeTitle } from "@/utils/titleNormalization";

type FindTrack = (normalizedTitle: string, firstPageOnly?: boolean) => Promise<string | undefined>;
type Lookup = (title: string) => Promise<string | undefined>;

const SHORT_SEARCH_CONCURRENCY = 6;
const SHORT_SEARCH_MAX_WORDS = 3;

function sentenceWords(sentence: string): string[] {
    return normalizeTitle(sentence).split(" ").filter(Boolean);
}

/** Report the gaps in the best non-overlapping coverage from titles found so far. */
export function findUnmatchedSpans(sentence: string, matchedTitles: ReadonlySet<string>): UnmatchedSpan[] {
    const words = sentenceWords(sentence);
    let maxWords = 0;
    for (const title of matchedTitles) maxWords = Math.max(maxWords, title.split(" ").length);
    const coverage = new Array<number>(words.length + 1).fill(0);
    const matchedEnd = new Array<number>(words.length).fill(0);
    for (let start = words.length - 1; start >= 0; start--) {
        coverage[start] = coverage[start + 1];
        for (let end = start + 1; end <= Math.min(words.length, start + maxWords); end++) {
            const count = end - start + coverage[end];
            if (count < coverage[start] || !matchedTitles.has(words.slice(start, end).join(" "))) continue;
            coverage[start] = count;
            matchedEnd[start] = end;
        }
    }
    const gaps: UnmatchedSpan[] = [];
    for (let start = 0; start < words.length;) {
        if (matchedEnd[start]) {
            start = matchedEnd[start];
            continue;
        }
        let end = start + 1;
        while (end < words.length && !matchedEnd[end]) end++;
        gaps.push({ startWord: start, endWordExclusive: end, text: words.slice(start, end).join(" ") });
        start = end;
    }
    return gaps;
}

export async function matchPlaylistTracks(
    sentence: string,
    mode: Mode,
    findTrack: FindTrack
): Promise<string[]> {
    const words = sentenceWords(sentence);
    const firstPageLookup = memoizeLookup((title) => findTrack(title, true));
    const lookup = memoizeLookup(async (title) => {
        // Shallow misses may still match on a later page.
        return (await firstPageLookup.pending.get(title)) ?? findTrack(title);
    });

    return mode === Mode.LONG
        ? matchTitles(words, lookup.find, true)
        : matchShortTitles(words, firstPageLookup.find, lookup.find);
}

function memoizeLookup(lookup: Lookup) {
    const pending = new Map<string, ReturnType<Lookup>>();
    const find: Lookup = (title) => {
        const existing = pending.get(title);
        if (existing) return existing;
        const result = lookup(title);
        pending.set(title, result);
        return result;
    };
    return { find, pending };
}

async function matchShortTitles(
    words: string[],
    firstPageLookup: Lookup,
    lookup: Lookup
): Promise<string[]> {
    if (words.length === 0) return [];

    const matches: { end: number; track: string }[][] = words.map(() => []);
    for (let length = 1; length <= SHORT_SEARCH_MAX_WORDS; length++) {
        const spans: { start: number; end: number; title: string }[] = [];
        for (let start = 0; start + length <= words.length; start++) {
            const end = start + length;
            // A phrase made entirely of matched single words adds no coverage.
            if (length > 1 && matches.slice(start, end).every(
                (edges, i) => edges[0]?.end === start + i + 1
            )) continue;
            spans.push({ start, end, title: words.slice(start, end).join(" ") });
        }

        const byTitle = new Map<string, typeof spans>();
        for (const span of spans) {
            const occurrences = byTitle.get(span.title);
            if (occurrences) occurrences.push(span);
            else byTitle.set(span.title, [span]);
        }
        const queries = [...byTitle.entries()];
        for (let i = 0; i < queries.length; i += SHORT_SEARCH_CONCURRENCY) {
            await Promise.all(queries.slice(i, i + SHORT_SEARCH_CONCURRENCY).map(
                async ([title, occurrences]) => {
                    const track = await firstPageLookup(title);
                    if (!track) return;
                    for (const { start, end } of occurrences) {
                        matches[start].push({ end, track });
                    }
                }
            ));
        }

        const best: ({ end: number; track: string; count: number } | undefined)[] = [];
        for (let start = words.length - 1; start >= 0; start--) {
            for (const { end, track } of matches[start]) {
                const suffixCount = end === words.length ? 0 : best[end]?.count;
                const previous = best[start];
                if (suffixCount !== undefined && (!previous || suffixCount + 1 > previous.count)) {
                    best[start] = { end, track, count: suffixCount + 1 };
                }
            }
        }
        if (best[0]) {
            const tracks: string[] = [];
            for (let start = 0; start < words.length; ) {
                const edge = best[start]!;
                tracks.push(edge.track);
                start = edge.end;
            }
            return tracks;
        }
    }

    return matchTitles(words, lookup, false);
}

async function matchTitles(
    words: string[],
    lookup: Lookup,
    longestFirst: boolean
): Promise<string[]> {
    const unmatched = new Set<number>();
    const tracks: string[] = [];

    async function matchFrom(start: number): Promise<boolean> {
        if (start === words.length) return true;

        const remaining = words.length - start;
        const maxLength = longestFirst ? remaining : Math.min(remaining, SHORT_SEARCH_MAX_WORDS);
        for (let offset = 0; offset < maxLength; offset++) {
            const end = longestFirst ? words.length - offset : start + 1 + offset;
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
