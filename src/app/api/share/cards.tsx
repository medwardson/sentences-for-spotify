/* eslint-disable @next/next/no-img-element -- satori markup, not a page */
import { readFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "next/og";
import type { ListeningTrack, TimeRange } from "@/utils/listening";

export const CARDS = ["rotation", "eras"] as const;
export type Card = (typeof CARDS)[number];

type Font = NonNullable<
    NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>[number];

const ROTATION_EYEBROW: Record<TimeRange, string> = {
    short_term: "YOUR MONTH IN HEAVY ROTATION",
    medium_term: "YOUR LAST 6 MONTHS IN HEAVY ROTATION",
    long_term: "YOUR YEAR IN HEAVY ROTATION",
};

const FONT_QUERIES: Record<Card, string> = {
    rotation: "family=DM+Serif+Display&family=Inter:wght@400;600;800",
    // static instances at the optical sizes a browser picks for the mock's 40px and 200px text
    eras: "family=Fraunces:opsz,wght@40,600;144,900&family=Inter:wght@400;600;800",
};

const LOGO = `data:image/svg+xml;base64,${readFileSync(
    join(process.cwd(), "public/images/spotify-full-logo-white.svg")
).toString("base64")}`;

const fontCache = new Map<string, Promise<Font[]>>();

async function fetchFonts(query: string): Promise<Font[]> {
    // without a modern User-Agent Google serves TTF, which satori can read (it can't read woff2)
    const css = await fetch(`https://fonts.googleapis.com/css2?${query}`, {
        headers: { "User-Agent": "Mozilla/4.0" },
    }).then((res) => res.text());
    const faces = [
        ...css.matchAll(
            /font-family: '([^']+)';[^}]*?font-weight: (\d+);[^}]*?url\(([^)]+)\) format\('truetype'\)/g
        ),
    ];
    if (faces.length === 0) throw new Error("No TTF fonts in Google Fonts CSS");
    return Promise.all(
        faces.map(async ([, name, weight, url]) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Font ${url} returned ${res.status}`);
            return {
                name,
                weight: Number(weight) as Font["weight"],
                style: "normal" as const,
                data: await res.arrayBuffer(),
            };
        })
    );
}

function loadFonts(query: string) {
    let fonts = fontCache.get(query);
    if (!fonts) {
        fonts = fetchFonts(query).catch((error) => {
            console.error(
                "Failed to load card fonts:",
                (error as Error).message
            );
            fontCache.delete(query);
            return [];
        });
        fontCache.set(query, fonts);
    }
    return fonts;
}

const Credit = ({
    muted,
    style,
}: {
    muted: string;
    style: React.CSSProperties;
}) => (
    <div
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            ...style,
        }}
    >
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                color: muted,
            }}
        >
            <span>Data from</span>
            <img src={LOGO} alt="Spotify" width={160} height={44} />
        </div>
        <span style={{ fontWeight: 600 }}>Sentences for Spotify</span>
    </div>
);

const TILTS = ["-3deg", "2deg", "-1.5deg", "3deg", "-2deg", "1.5deg"];
const TILE_COLORS = [
    ["#ffffff", "#121212"],
    ["#121212", "#ffffff"],
    ["#ffffff", "#121212"],
    ["#1ed760", "#121212"],
    ["#ffffff", "#121212"],
    ["#ffd23f", "#121212"],
];

function RotationCard({
    tracks,
    range,
}: {
    tracks: ListeningTrack[];
    range: TimeRange;
}) {
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#e9f1ec",
                color: "#121212",
                fontFamily: "Inter",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "96px 80px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}
            >
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 600,
                        letterSpacing: 4.16,
                        color: "#4a4a4a",
                    }}
                >
                    {ROTATION_EYEBROW[range]}
                </div>
                <div
                    style={{
                        fontFamily: "DM Serif Display",
                        fontSize: 80,
                        lineHeight: 1.1,
                    }}
                >
                    {`The ${tracks.length} songs you couldn’t stop playing.`}
                </div>
            </div>
            <div
                style={{
                    flex: 1,
                    padding: "80px 72px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignContent: "center",
                    justifyContent: "center",
                    rowGap: 36,
                    columnGap: 28,
                }}
            >
                {tracks.map((track, i) => {
                    const [bg, fg] = TILE_COLORS[i % TILE_COLORS.length];
                    return (
                        <div
                            key={track.id}
                            style={{
                                maxWidth: 936,
                                transform: `rotate(${TILTS[i % TILTS.length]})`,
                                background: bg,
                                color: fg,
                                padding: "28px 36px 24px",
                                borderRadius: 8,
                                boxShadow:
                                    "0 4px 0 rgba(0,0,0,0.18), 0 16px 36px rgba(0,0,0,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "DM Serif Display",
                                    fontSize: 68,
                                    lineHeight: 1,
                                }}
                            >
                                {track.name}
                            </span>
                            <span
                                style={{
                                    fontSize: 24,
                                    fontWeight: 600,
                                    opacity: 0.8,
                                }}
                            >
                                {track.artists[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
            <Credit
                muted="#b3b3b3"
                style={{
                    background: "#121212",
                    color: "#ffffff",
                    padding: "40px 80px 48px",
                }}
            />
        </div>
    );
}

interface Dated {
    track: ListeningTrack;
    year: number;
}

const ERAS_ACCENT = "#ffb547";
const ERAS_MUTED = "#c9bfdc";
const ERAS_PANEL = "#2e2350";

function erasStats(tracks: ListeningTrack[], now: Date) {
    const dated: Dated[] = tracks
        .map((track) => ({
            track,
            year: Number(track.album.releaseDate.slice(0, 4)),
        }))
        .filter(({ year }) => year > 0);
    if (dated.length < 5) return null;

    const averageYear = Math.round(
        dated.reduce((sum, d) => sum + d.year, 0) / dated.length
    );
    const counts = new Map<number, number>();
    for (const { year } of dated) {
        const decade = Math.floor(year / 10) * 10;
        counts.set(decade, (counts.get(decade) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    return {
        count: tracks.length,
        averageYear,
        age: now.getFullYear() - averageYear,
        decades: [...counts]
            .sort(([a], [b]) => a - b)
            .map(([decade, count]) => ({
                label: `${decade}s`,
                count,
                width: `${Math.round((count / max) * 100)}%`,
                fill: count === max ? ERAS_ACCENT : "#8a7bb8",
            })),
        oldest: dated.reduce((a, b) => (b.year < a.year ? b : a)),
        newest: dated.reduce((a, b) => (b.year > a.year ? b : a)),
    };
}

const EraTrack = ({ label, dated }: { label: string; dated: Dated }) => (
    <div
        style={{
            flex: 1,
            background: ERAS_PANEL,
            borderRadius: 16,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 8,
        }}
    >
        <span
            style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 2.88,
                color: ERAS_MUTED,
            }}
        >
            {label}
        </span>
        <span style={{ fontSize: 34, fontWeight: 800 }}>
            {dated.track.name}
        </span>
        <span style={{ fontSize: 28, color: ERAS_MUTED }}>
            {`${dated.track.artists[0]} · ${dated.year}`}
        </span>
    </div>
);

function ErasCard({
    stats,
}: {
    stats: NonNullable<ReturnType<typeof erasStats>>;
}) {
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#1d1433",
                color: "#fff7ea",
                fontFamily: "Inter",
                padding: "96px 80px 56px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: 4.16,
                    color: ERAS_MUTED,
                }}
            >
                {`YOUR TOP ${stats.count} SONGS · THIS YEAR`}
            </div>
            <div
                style={{
                    marginTop: 40,
                    fontFamily: "Fraunces",
                    fontWeight: 900,
                    fontSize: 400,
                    lineHeight: 0.85,
                    letterSpacing: -16,
                    color: ERAS_ACCENT,
                }}
            >
                {String(stats.age)}
            </div>
            <div
                style={{
                    marginTop: 24,
                    fontFamily: "Fraunces",
                    fontWeight: 600,
                    fontSize: 80,
                    lineHeight: 1.1,
                }}
            >
                {`Your ears are ${stats.age} ${stats.age === 1 ? "year" : "years"} old.`}
            </div>
            <div
                style={{
                    marginTop: 24,
                    fontSize: 34,
                    lineHeight: 1.5,
                    color: ERAS_MUTED,
                }}
            >
                {`The average song you love came out in ${stats.averageYear}.`}
            </div>
            <div
                style={{
                    marginTop: 72,
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}
            >
                {stats.decades.map((d) => (
                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 24,
                        }}
                    >
                        <span
                            style={{
                                width: 128,
                                fontSize: 30,
                                fontWeight: 600,
                                color: ERAS_MUTED,
                            }}
                        >
                            {d.label}
                        </span>
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                height: 44,
                                borderRadius: 8,
                                background: ERAS_PANEL,
                            }}
                        >
                            <div
                                style={{
                                    width: d.width,
                                    height: 44,
                                    borderRadius: 8,
                                    background: d.fill,
                                }}
                            />
                        </div>
                        <span
                            style={{
                                width: 56,
                                display: "flex",
                                justifyContent: "flex-end",
                                fontSize: 30,
                                fontWeight: 800,
                            }}
                        >
                            {String(d.count)}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 64, display: "flex", gap: 24 }}>
                <EraTrack label="OLDEST" dated={stats.oldest} />
                <EraTrack label="NEWEST" dated={stats.newest} />
            </div>
            <Credit
                muted={ERAS_MUTED}
                style={{
                    marginTop: "auto",
                    paddingTop: 40,
                    borderTop: "2px solid #3a2e5e",
                }}
            />
        </div>
    );
}

// null when there isn't enough listening history for the card
export async function renderCard(
    card: Card,
    tracks: ListeningTrack[],
    range: TimeRange,
    now = new Date()
): Promise<ImageResponse | null> {
    let design: React.ReactElement;
    if (card === "rotation") {
        if (tracks.length < 3) return null;
        design = <RotationCard tracks={tracks.slice(0, 6)} range={range} />;
    } else {
        const stats = erasStats(tracks, now);
        if (!stats) return null;
        design = <ErasCard stats={stats} />;
    }

    const fonts = await loadFonts(FONT_QUERIES[card]);
    return new ImageResponse(design, {
        width: 1080,
        height: 1920,
        fonts: fonts.length ? fonts : undefined,
    });
}
