import type {
    ListeningArtist,
    ListeningTrack,
    RecentPlay,
} from "@/utils/listening";

export type Headline = [before: string, accent: string, after: string];

const plotY = (rank: number | null) =>
    rank == null ? 26 : 3 + ((Math.min(rank, 20) - 1) / 19) * 22;

export function tickerStats(
    short: ListeningArtist[],
    medium: ListeningArtist[],
    long: ListeningArtist[]
) {
    if (short.length < 3) return null;
    const rankIn = (artists: ListeningArtist[], id: string) => {
        const i = artists.findIndex((a) => a.id === id);
        return i === -1 ? null : i + 1;
    };

    const rows = short.slice(0, 8).map((artist, i) => {
        const rank = i + 1;
        const mediumRank = rankIn(medium, artist.id);
        const longRank = rankIn(long, artist.id);
        const change = mediumRank == null ? null : mediumRank - rank;
        const points = [
            [6, plotY(longRank)],
            [36, plotY(mediumRank)],
            [66, plotY(rank)],
        ];
        return {
            rank,
            name: artist.name,
            change,
            label:
                change == null
                    ? "NEW"
                    : change === 0
                      ? "━ 0"
                      : `${change > 0 ? "▲" : "▼"}${Math.abs(change)}`,
            path: `M${points.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(" L")}`,
            endY: plotY(rank),
        };
    });

    const riser = rows.reduce<(typeof rows)[number] | undefined>(
        (best, row) =>
            row.change != null && row.change > (best?.change ?? 0)
                ? row
                : best,
        undefined
    );
    const entrant = rows.find((row) => row.change == null);
    const spots = riser?.change === 1 ? "spot" : "spots";
    const headline: Headline = riser
        ? [`${riser.name} is up`, `${riser.change} ${spots}`, "this month"]
        : entrant
          ? [entrant.name, "just entered", "your top artists"]
          : ["Your top artists", "held steady", "this month"];

    const tape = [...rows]
        .sort((a, b) => (b.change ?? Infinity) - (a.change ?? Infinity))
        .map((row) => `${row.name.toUpperCase()} ${row.label}`)
        .join(" · ");

    return { rows, headline, tape };
}

export const isNight = (hour: number) => hour >= 21 || hour <= 2;
const isMorning = (hour: number) => hour >= 5 && hour <= 10;

export const formatHour = (hour: number) =>
    `${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}`;

export function clockStats(recent: RecentPlay[], timeZone: string) {
    const total = recent.length;
    if (total < 10) return null;

    const hourOf = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
    });
    const counts: number[] = Array(24).fill(0);
    for (const play of recent) {
        counts[Number(hourOf.format(new Date(play.playedAt)))]++;
    }
    const sum = (match: (hour: number) => boolean) =>
        counts.reduce((n, count, hour) => (match(hour) ? n + count : n), 0);
    const night = sum(isNight);
    const morning = sum(isMorning);
    const nightOwl = night / total >= 0.5;
    const earlyBird = !nightOwl && morning / total >= 0.4;

    const headline: Headline = nightOwl
        ? ["Certified", "night owl", ""]
        : earlyBird
          ? ["Early", "bird", ""]
          : ["", "Round-the-clock", "listener"];
    const subline = nightOwl
        ? `${night} of your last ${total} plays happened after 9 pm.`
        : earlyBird
          ? `${morning} of your last ${total} plays happened before 11 am.`
          : `Your last ${total} plays were spread across the day.`;

    return {
        counts,
        total,
        night,
        nightOwl,
        earlyBird,
        peakHour: counts.indexOf(Math.max(...counts)),
        headline,
        subline,
    };
}

export function shelfAlbums(tracks: ListeningTrack[]) {
    const albums = new Map<
        string,
        { title: string; artist: string; image: string }
    >();
    for (const { album, artists } of tracks) {
        const key = `${album.name}\u0000${artists[0]}`;
        if (album.image && !albums.has(key)) {
            albums.set(key, {
                title: album.name,
                artist: artists[0],
                image: album.image,
            });
        }
    }
    const shelves = Math.min(Math.floor(albums.size / 3), 3);
    return shelves ? [...albums.values()].slice(0, shelves * 3) : null;
}

export function listenerStats({
    recent,
    short,
    long,
    averageYear,
    timeZone,
    now,
}: {
    recent: RecentPlay[];
    short: ListeningArtist[];
    long: ListeningArtist[];
    averageYear: number | undefined;
    timeZone: string;
    now: Date;
}) {
    const clock = clockStats(recent, timeZone);
    if (!clock || long.length < 5 || averageYear === undefined) return null;

    const ids = (artists: ListeningArtist[], n: number) =>
        new Set(artists.slice(0, n).map((a) => a.id));
    const shortTop5 = ids(short, 5);
    const loyalty = long.slice(0, 5).filter((a) => shortTop5.has(a.id)).length;
    const longTop50 = ids(long, 50);
    const explorer = short
        .slice(0, 20)
        .filter((a) => !longTop50.has(a.id)).length;
    const age = now.getFullYear() - averageYear;

    const adjective = clock.nightOwl
        ? "Nocturnal "
        : clock.earlyBird
          ? "Early-Rising "
          : "";
    const noun =
        age >= 12
            ? "Nostalgic"
            : loyalty >= 4
              ? "Loyalist"
              : explorer >= 8
                ? "Explorer"
                : "Eclectic";

    const clauses = [
        clock.nightOwl
            ? "Lives after dark"
            : clock.earlyBird
              ? "Starts the day with music"
              : "Listens around the clock",
        loyalty >= 4
            ? "loyal to old favourites"
            : loyalty <= 1
              ? "moving on from old favourites"
              : "balanced between old and new favourites",
    ];
    if (age >= 12) clauses.push("drawn to past decades");
    else if (explorer >= 8) clauses.push("always finding new artists");

    return {
        type: `The ${adjective}${noun}`,
        description: `${clauses.join(", ")}.`,
        signature: long[0].name,
        stats: [
            {
                label: "NIGHT OWL",
                value: `${clock.night} / ${clock.total}`,
                fill: clock.night / clock.total,
            },
            { label: "LOYALTY", value: `${loyalty} / 5`, fill: loyalty / 5 },
            {
                label: "EXPLORER",
                value: `${explorer} new`,
                fill: Math.min(explorer / 10, 1),
            },
            {
                label: "TIME TRAVEL",
                value: String(averageYear),
                fill: Math.min(Math.max(age / 40, 0), 1),
            },
        ],
    };
}
