/* eslint-disable @next/next/no-img-element -- satori markup, not a page */
import { readFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "next/og";
import type { Listening, ListeningTrack, TimeRange } from "@/utils/listening";
import {
    Headline,
    clockStats,
    formatHour,
    isNight,
    listenerStats,
    shelfAlbums,
    tickerStats,
} from "./stats";

export const CARDS = [
    "rotation",
    "eras",
    "ticker",
    "clock",
    "shelf",
    "card",
] as const;
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
    ticker: "family=JetBrains+Mono:wght@400;600;800&family=Inter:wght@400;600;800",
    clock: "family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600;800",
    shelf: "family=Fraunces:opsz,wght@44,600&family=Inter:wght@400;600;800",
    card: "family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600;800",
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

const monthYear = (now: Date) =>
    now
        .toLocaleString("en-US", { month: "short", year: "numeric" })
        .toUpperCase();

const ellipsis: React.CSSProperties = {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
};

// satori lays out each text node as one flex item, so a line with an accent span wraps only between words
const Words = ({
    headline,
    accent,
    style,
}: {
    headline: Headline;
    accent: string;
    style: React.CSSProperties;
}) => (
    <div
        style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: "0.25em",
            ...style,
        }}
    >
        {headline.flatMap((text, i) =>
            text
                .split(" ")
                .filter(Boolean)
                .map((word, j) => (
                    <span
                        key={`${i}-${j}`}
                        style={i === 1 ? { color: accent } : undefined}
                    >
                        {word}
                    </span>
                ))
        )}
    </div>
);

const TICKER_ACCENT = "#1ed760";
const TICKER_DOWN = "#ff9f43";
const TICKER_MUTED = "#a7a7a7";

const TickerColumns = ({
    cells,
    style,
}: {
    cells: React.ReactNode[];
    style: React.CSSProperties;
}) => (
    <div style={{ display: "flex", alignItems: "center", gap: 24, ...style }}>
        <div style={{ display: "flex", width: 64 }}>{cells[0]}</div>
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{cells[1]}</div>
        <div style={{ display: "flex", width: 144 }}>{cells[2]}</div>
        <div style={{ display: "flex", width: 128, justifyContent: "flex-end" }}>
            {cells[3]}
        </div>
    </div>
);

function TickerCard({
    stats,
    now,
}: {
    stats: NonNullable<ReturnType<typeof tickerStats>>;
    now: Date;
}) {
    const color = (change: number | null) =>
        change == null || change > 0
            ? TICKER_ACCENT
            : change < 0
              ? TICKER_DOWN
              : TICKER_MUTED;
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#0a0a0a",
                color: "#ffffff",
                fontFamily: "JetBrains Mono",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    background: TICKER_ACCENT,
                    color: "#0a0a0a",
                    fontWeight: 800,
                    fontSize: 26,
                    letterSpacing: 2.08,
                    padding: "20px 48px",
                    ...ellipsis,
                    textOverflow: "clip",
                }}
            >
                {stats.tape}
            </div>
            <div
                style={{
                    padding: "72px 64px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                <div
                    style={{
                        fontSize: 26,
                        letterSpacing: 4.16,
                        color: TICKER_MUTED,
                    }}
                >
                    {`YOUR ARTIST MARKET · ${monthYear(now)}`}
                </div>
                <Words
                    headline={stats.headline}
                    accent={TICKER_ACCENT}
                    style={{
                        fontFamily: "Inter",
                        fontSize: 88,
                        lineHeight: 1.05,
                        fontWeight: 800,
                        letterSpacing: -1.76,
                    }}
                />
            </div>
            <TickerColumns
                cells={[
                    "#",
                    "ARTIST",
                    "1Y→NOW",
                    "CHG",
                ]}
                style={{
                    margin: "56px 64px 0",
                    fontSize: 22,
                    letterSpacing: 2.64,
                    color: TICKER_MUTED,
                    paddingBottom: 20,
                    borderBottom: "2px solid #2a2a2a",
                }}
            />
            <div
                style={{
                    margin: "0 64px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {stats.rows.map((row) => (
                    <TickerColumns
                        key={row.rank}
                        style={{
                            height: 116,
                            borderBottom: "2px solid #1c1c1c",
                        }}
                        cells={[
                            <span
                                key="rank"
                                style={{ fontSize: 40, fontWeight: 800 }}
                            >
                                {String(row.rank)}
                            </span>,
                            <span
                                key="name"
                                style={{
                                    fontSize: 34,
                                    fontWeight: 600,
                                    ...ellipsis,
                                }}
                            >
                                {row.name}
                            </span>,
                            <svg
                                key="plot"
                                width={144}
                                height={56}
                                viewBox="0 0 72 28"
                            >
                                <path
                                    d={row.path}
                                    fill="none"
                                    stroke={color(row.change)}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <circle
                                    cx={66}
                                    cy={row.endY}
                                    r={3.5}
                                    fill={color(row.change)}
                                />
                            </svg>,
                            <span
                                key="change"
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: color(row.change),
                                }}
                            >
                                {row.label}
                            </span>,
                        ]}
                    />
                ))}
            </div>
            <div
                style={{
                    marginTop: "auto",
                    padding: "40px 64px 56px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                    borderTop: "2px solid #2a2a2a",
                }}
            >
                <div
                    style={{
                        fontSize: 22,
                        lineHeight: 1.5,
                        color: TICKER_MUTED,
                    }}
                >
                    Rank in your top artists: last year → last 6 months →
                    last 4 weeks
                </div>
                <Credit muted={TICKER_MUTED} style={{ fontFamily: "Inter" }} />
            </div>
        </div>
    );
}

const CLOCK_ACCENT = "#ffd23f";
const CLOCK_MUTED = "#aab8d9";
const CLOCK_DAY = "#5b74b8";
const CLOCK_LINE = "#22305a";

function clockPaths(counts: number[]) {
    const max = Math.max(...counts);
    const segment = (hour: number, length: number) => {
        const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
        const point = (r: number) =>
            `${(230 + r * Math.cos(angle)).toFixed(1)} ${(230 + r * Math.sin(angle)).toFixed(1)}`;
        return `M${point(92)} L${point(92 + length)} `;
    };
    let ticks = "";
    let day = "";
    let night = "";
    counts.forEach((count, hour) => {
        ticks += segment(hour, 0.1);
        if (!count) return;
        // the mock's 10 px per play for a 10-play peak, scaled to stay inside the outer ring
        const bar = segment(hour, (count / max) * 100);
        if (isNight(hour)) night += bar;
        else day += bar;
    });
    return { ticks, day, night };
}

const ClockLabel = ({
    text,
    style,
}: {
    text: string;
    style: React.CSSProperties;
}) => (
    <span
        style={{
            position: "absolute",
            fontSize: 26,
            fontWeight: 600,
            color: CLOCK_MUTED,
            ...style,
        }}
    >
        {text}
    </span>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
    <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
            style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: color,
            }}
        />
        {label}
    </span>
);

function ClockCard({
    stats,
}: {
    stats: NonNullable<ReturnType<typeof clockStats>>;
}) {
    const paths = clockPaths(stats.counts);
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#0b1530",
                color: "#f2f6ff",
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
                    color: CLOCK_MUTED,
                }}
            >
                WHEN YOU LISTEN
            </div>
            <Words
                headline={stats.headline}
                accent={CLOCK_ACCENT}
                style={{
                    marginTop: 28,
                    fontFamily: "Space Grotesk",
                    fontSize: 104,
                    lineHeight: 1,
                    fontWeight: 700,
                    letterSpacing: -2.08,
                }}
            />
            <div
                style={{
                    marginTop: 28,
                    fontSize: 34,
                    lineHeight: 1.5,
                    color: CLOCK_MUTED,
                }}
            >
                {stats.subline}
            </div>
            <div
                style={{
                    marginTop: 56,
                    position: "relative",
                    width: 920,
                    height: 920,
                    alignSelf: "center",
                    display: "flex",
                }}
            >
                <svg width={920} height={920} viewBox="0 0 460 460">
                    <circle
                        cx={230}
                        cy={230}
                        r={78}
                        fill="none"
                        stroke={CLOCK_LINE}
                        strokeWidth={1}
                    />
                    <circle
                        cx={230}
                        cy={230}
                        r={200}
                        fill="none"
                        stroke={CLOCK_LINE}
                        strokeWidth={1}
                        strokeDasharray="2 6"
                    />
                    {[
                        [paths.ticks, CLOCK_LINE],
                        [paths.day, CLOCK_DAY],
                        [paths.night, CLOCK_ACCENT],
                    ]
                        .filter(([d]) => d)
                        .map(([d, stroke]) => (
                            <path
                                key={stroke}
                                d={d}
                                stroke={stroke}
                                strokeWidth={10}
                                strokeLinecap="round"
                                fill="none"
                            />
                        ))}
                </svg>
                <ClockLabel
                    text="12 am"
                    style={{
                        top: 12,
                        width: 920,
                        display: "flex",
                        justifyContent: "center",
                    }}
                />
                <ClockLabel text="6 am" style={{ top: 442, right: 16 }} />
                <ClockLabel
                    text="12 pm"
                    style={{
                        top: 876,
                        width: 920,
                        display: "flex",
                        justifyContent: "center",
                    }}
                />
                <ClockLabel text="6 pm" style={{ top: 442, left: 16 }} />
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 920,
                        height: 920,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    <span
                        style={{
                            fontFamily: "Space Grotesk",
                            fontSize: 80,
                            fontWeight: 700,
                            lineHeight: 1,
                        }}
                    >
                        {formatHour(stats.peakHour)}
                    </span>
                    <span
                        style={{
                            fontSize: 26,
                            fontWeight: 600,
                            color: CLOCK_MUTED,
                        }}
                    >
                        YOUR PEAK HOUR
                    </span>
                </div>
            </div>
            <div
                style={{
                    marginTop: 40,
                    display: "flex",
                    gap: 40,
                    justifyContent: "center",
                    fontSize: 26,
                    color: CLOCK_MUTED,
                }}
            >
                <LegendDot color={CLOCK_ACCENT} label="9 pm – 3 am" />
                <LegendDot color={CLOCK_DAY} label="Daytime" />
            </div>
            <div
                style={{
                    marginTop: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                    paddingTop: 40,
                    borderTop: `2px solid ${CLOCK_LINE}`,
                }}
            >
                <div style={{ fontSize: 22, color: CLOCK_MUTED }}>
                    {`Based on your last ${stats.total} plays`}
                </div>
                <Credit muted={CLOCK_MUTED} style={{}} />
            </div>
        </div>
    );
}

const SHELF_MUTED = "#d7c4ae";
const COVER = 285;
const COVER_TIMEOUT_MS = 2500;

type Album = NonNullable<ReturnType<typeof shelfAlbums>>[number];

// satori fetches remote images with no timeout, so a stalled CDN hangs the whole render
async function loadCovers(albums: Album[]) {
    let timedOut = 0;
    let failed = 0;
    let slowest = 0;
    const covers = await Promise.all(
        albums.map(async (album) => {
            const started = performance.now();
            try {
                const res = await fetch(album.image, {
                    signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
                });
                if (!res.ok) throw new Error(`${res.status}`);
                const type = res.headers.get("content-type") ?? "image/jpeg";
                const data = Buffer.from(await res.arrayBuffer());
                return `data:${type};base64,${data.toString("base64")}`;
            } catch (error) {
                if ((error as Error).name === "TimeoutError") timedOut++;
                else failed++;
                return null;
            } finally {
                slowest = Math.max(slowest, performance.now() - started);
            }
        })
    );
    (timedOut || failed ? console.warn : console.log)(
        `shelf covers: ${albums.length - timedOut - failed} loaded, ${timedOut} timed out, ${failed} failed, slowest ${Math.round(slowest)}ms`
    );
    return albums.map((album, i) => ({ ...album, image: covers[i] }));
}

function ShelfCard({
    albums,
}: {
    albums: Awaited<ReturnType<typeof loadCovers>>;
}) {
    const shelves = [0, 3, 6]
        .map((i) => albums.slice(i, i + 3))
        .filter((shelf) => shelf.length);
    const row: React.CSSProperties = {
        display: "flex",
        gap: 32,
        padding: "0 16px",
    };
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#2b211c",
                color: "#fbf3e8",
                fontFamily: "Inter",
                padding: "96px 64px 56px",
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
                    color: SHELF_MUTED,
                }}
            >
                ON REPEAT · LAST 6 MONTHS
            </div>
            <div
                style={{
                    marginTop: 24,
                    fontFamily: "Fraunces",
                    fontWeight: 600,
                    fontSize: 88,
                    lineHeight: 1.05,
                }}
            >
                Your record shelf
            </div>
            <div
                style={{
                    marginTop: 64,
                    display: "flex",
                    flexDirection: "column",
                    gap: 44,
                }}
            >
                {shelves.map((shelf, i) => (
                    <div
                        key={i}
                        style={{ display: "flex", flexDirection: "column" }}
                    >
                        <div style={row}>
                            {shelf.map((album) =>
                                album.image ? (
                                    <img
                                        key={`${album.title}\u0000${album.artist}`}
                                        src={album.image}
                                        alt={`Album cover: ${album.title} by ${album.artist}`}
                                        width={COVER}
                                        height={COVER}
                                        style={{
                                            borderRadius: 8,
                                            boxShadow:
                                                "0 12px 28px rgba(0,0,0,0.35)",
                                        }}
                                    />
                                ) : (
                                    <div
                                        key={`${album.title}\u0000${album.artist}`}
                                        style={{
                                            width: COVER,
                                            height: COVER,
                                            borderRadius: 8,
                                            background: "#4a3a30",
                                        }}
                                    />
                                )
                            )}
                        </div>
                        <div
                            style={{
                                height: 24,
                                borderRadius: 4,
                                background: "#7a5439",
                                boxShadow: "0 12px 20px rgba(0,0,0,0.35)",
                            }}
                        />
                        <div style={{ ...row, paddingTop: 16 }}>
                            {shelf.map((album) => (
                                <div
                                    key={`${album.title}\u0000${album.artist}`}
                                    style={{
                                        width: COVER,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 26,
                                            fontWeight: 800,
                                            ...ellipsis,
                                        }}
                                    >
                                        {album.title}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 24,
                                            color: SHELF_MUTED,
                                            ...ellipsis,
                                        }}
                                    >
                                        {album.artist}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <Credit
                muted={SHELF_MUTED}
                style={{
                    marginTop: "auto",
                    paddingTop: 40,
                    borderTop: "2px solid #4a3a30",
                }}
            />
        </div>
    );
}

const LISTENER_ACCENT = "#1ed760";
const LISTENER_MUTED = "#b3b3b3";
const LISTENER_TEXT = "#d0d0d0";
const LISTENER_LINE = "#3e3e3e";

function ListenerCard({
    stats,
    now,
}: {
    stats: NonNullable<ReturnType<typeof listenerStats>>;
    now: Date;
}) {
    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                background: "#121212",
                color: "#ffffff",
                fontFamily: "Inter",
                padding: "96px 80px 56px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    alignSelf: "stretch",
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: 4.16,
                    color: LISTENER_MUTED,
                }}
            >
                {`YOUR LISTENER CARD · ${monthYear(now)}`}
            </div>
            <div
                style={{
                    marginTop: 48,
                    width: 880,
                    border: `6px solid ${LISTENER_ACCENT}`,
                    borderRadius: 40,
                    padding: 16,
                    background: "#181818",
                    display: "flex",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        border: `2px solid ${LISTENER_LINE}`,
                        borderRadius: 28,
                        padding: "48px 48px 40px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 40,
                    }}
                >
                    <span
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            letterSpacing: 3.36,
                            color: LISTENER_ACCENT,
                        }}
                    >
                        TYPE
                    </span>
                    <div
                        style={{
                            marginTop: -16,
                            fontFamily: "Space Grotesk",
                            fontSize: 80,
                            lineHeight: 1.05,
                            fontWeight: 700,
                        }}
                    >
                        {stats.type}
                    </div>
                    <div
                        style={{
                            height: 360,
                            borderRadius: 20,
                            background: "#0b1530",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg width={320} height={280} viewBox="0 0 160 140">
                            <circle
                                cx={68}
                                cy={74}
                                r={56}
                                fill="#121212"
                                stroke={LISTENER_LINE}
                                strokeWidth={2}
                            />
                            <circle
                                cx={68}
                                cy={74}
                                r={40}
                                fill="none"
                                stroke="#2a2a2a"
                                strokeWidth={2}
                            />
                            <circle
                                cx={68}
                                cy={74}
                                r={26}
                                fill="none"
                                stroke="#2a2a2a"
                                strokeWidth={2}
                            />
                            <circle
                                cx={68}
                                cy={74}
                                r={12}
                                fill={LISTENER_ACCENT}
                            />
                            <path
                                d="M132 18a22 22 0 1 0 14 38a26 26 0 0 1-14-38z"
                                fill="#ffd23f"
                            />
                        </svg>
                    </div>
                    <div
                        style={{
                            fontSize: 30,
                            lineHeight: 1.5,
                            color: LISTENER_TEXT,
                        }}
                    >
                        {stats.description}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 24,
                        }}
                    >
                        {stats.stats.map((s) => (
                            <div
                                key={s.label}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 24,
                                }}
                            >
                                <span
                                    style={{
                                        width: 208,
                                        fontSize: 26,
                                        fontWeight: 800,
                                        letterSpacing: 1.56,
                                    }}
                                >
                                    {s.label}
                                </span>
                                <div
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        height: 20,
                                        borderRadius: 10,
                                        background: "#2a2a2a",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.round(s.fill * 100)}%`,
                                            height: 20,
                                            borderRadius: 10,
                                            background: LISTENER_ACCENT,
                                        }}
                                    />
                                </div>
                                <span
                                    style={{
                                        width: 128,
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        fontSize: 26,
                                        fontWeight: 600,
                                        color: LISTENER_TEXT,
                                    }}
                                >
                                    {s.value}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            paddingTop: 28,
                            borderTop: `2px solid ${LISTENER_LINE}`,
                            fontSize: 24,
                            color: LISTENER_MUTED,
                        }}
                    >
                        <span>Signature artist</span>
                        <span style={{ fontWeight: 800, color: "#ffffff" }}>
                            {stats.signature}
                        </span>
                    </div>
                </div>
            </div>
            <Credit
                muted={LISTENER_MUTED}
                style={{
                    marginTop: "auto",
                    alignSelf: "stretch",
                    paddingTop: 40,
                    borderTop: "2px solid #2a2a2a",
                }}
            />
        </div>
    );
}

// null when there isn't enough listening history for the card
export async function renderCard(
    card: Card,
    listening: Pick<Listening, "topTracks" | "topArtists" | "recent">,
    {
        range,
        timeZone,
        now = new Date(),
    }: { range: TimeRange; timeZone: string; now?: Date }
): Promise<ImageResponse | null> {
    const { topTracks, topArtists, recent } = listening;
    const fonts = loadFonts(FONT_QUERIES[card]);
    let design: React.ReactElement;
    if (card === "rotation") {
        const tracks = topTracks[range];
        if (tracks.length < 3) return null;
        design = <RotationCard tracks={tracks.slice(0, 6)} range={range} />;
    } else if (card === "eras") {
        const stats = erasStats(topTracks.long_term, now);
        if (!stats) return null;
        design = <ErasCard stats={stats} />;
    } else if (card === "ticker") {
        const stats = tickerStats(
            topArtists.short_term,
            topArtists.medium_term,
            topArtists.long_term
        );
        if (!stats) return null;
        design = <TickerCard stats={stats} now={now} />;
    } else if (card === "clock") {
        const stats = clockStats(recent, timeZone);
        if (!stats) return null;
        design = <ClockCard stats={stats} />;
    } else if (card === "shelf") {
        const albums = shelfAlbums(topTracks.medium_term);
        if (!albums) return null;
        design = <ShelfCard albums={await loadCovers(albums)} />;
    } else {
        const stats = listenerStats({
            recent,
            short: topArtists.short_term,
            long: topArtists.long_term,
            averageYear: erasStats(topTracks.long_term, now)?.averageYear,
            timeZone,
            now,
        });
        if (!stats) return null;
        design = <ListenerCard stats={stats} now={now} />;
    }

    const loaded = await fonts;
    return new ImageResponse(design, {
        width: 1080,
        height: 1920,
        fonts: loaded.length ? loaded : undefined,
    });
}
