"use client";

import GreenButton from "@/components/buttons/GreenButton";
import { Header } from "@/components/home/header/Header";
import withAuth from "@/components/useAuth";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.scss";

type Card = "rotation" | "eras" | "ticker" | "clock" | "shelf" | "card";
type Range = "short_term" | "medium_term" | "long_term";

const CARDS: {
    value: Card;
    label: string;
    short: string;
    icon: string;
    description: string;
    alt: string;
    ranges: Range[];
    caption?: string;
    timeZone?: boolean;
}[] = [
    {
        value: "rotation",
        label: "Heavy Rotation",
        short: "Rotation",
        icon: "M4 6h11M7 12h13M4 18h9",
        description: "Your top songs as magnet tiles",
        alt: "Card showing your most-played songs as magnet tiles",
        ranges: ["short_term", "medium_term", "long_term"],
    },
    {
        value: "eras",
        label: "Eras",
        short: "Eras",
        icon: "M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3",
        description: "How old are your ears?",
        alt: "Card showing how old your ears are, with your top songs by decade",
        ranges: ["long_term"],
        caption: "Based on your last year",
    },
    {
        value: "ticker",
        label: "Artist Ticker",
        short: "Ticker",
        icon: "M3 17l6-6 4 4 8-8M15 7h6v6",
        description: "Who’s rising and falling",
        alt: "Card showing your top artists as a stock ticker, with how far each moved up or down",
        ranges: ["short_term"],
        caption: "Last 4 weeks vs last 6 months",
    },
    {
        value: "clock",
        label: "Listening Clock",
        short: "Clock",
        icon: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7v5l3 2",
        description: "When you listen",
        alt: "Card showing your recent plays by hour of day on a clock, with your peak hour",
        ranges: ["short_term"],
        caption: "Based on your last 50 plays",
        timeZone: true,
    },
    {
        value: "shelf",
        label: "Record Shelf",
        short: "Shelf",
        icon: "M4 4h16v16H4zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
        description: "Albums on repeat",
        alt: "Card showing the albums you have on repeat as covers on a record shelf",
        ranges: ["medium_term"],
        caption: "Based on your last 6 months",
    },
    {
        value: "card",
        label: "Listener Card",
        short: "Card",
        icon: "M3 6h18v12H3zM7 10h4M7 14h7",
        description: "Your listening personality",
        alt: "Card showing your listener type, with night owl, loyalty, explorer and time travel stats",
        ranges: ["long_term"],
        caption: "Based on your year and your last 50 plays",
        timeZone: true,
    },
];

const RANGE_LABELS: Record<Range, string> = {
    short_term: "Last 4 weeks",
    medium_term: "Last 6 months",
    long_term: "Last year",
};

type Preview =
    | { status: "loading" }
    | { status: "ready"; blob: Blob; url: string }
    | { status: "reconnect" | "empty" | "error" };

const LOADING: Preview = { status: "loading" };

const previewSize = "h-[480px] w-[270px] md:h-[640px] md:w-[360px]";

const cardSrcs = (
    { value, ranges, timeZone }: (typeof CARDS)[number],
    zone: string
) =>
    ranges.map((range) =>
        value === "rotation"
            ? `/api/share/rotation?range=${range}`
            : timeZone
              ? `/api/share/${value}?tz=${encodeURIComponent(zone)}`
              : `/api/share/${value}`
    );

// srcs[0] loads first: its request refreshes a stale listening cache before the rest run in parallel
function usePreviews(srcs: string[]): Record<string, Preview> {
    const key = srcs.join(" ");
    const [previews, setPreviews] = useState<Record<string, Preview>>({});

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const urls: string[] = [];
        let refreshing: Promise<unknown> | undefined;

        const fetchPreview = async (src: string): Promise<Preview> => {
            let res = await fetch(src, { signal });
            if (res.status === 401) {
                // the access_token cookie expired; the session route refreshes it, once for all slides
                refreshing ??= fetch("/api/auth/session", { signal });
                await refreshing;
                res = await fetch(src, { signal });
            }
            if (res.status === 403) return { status: "reconnect" };
            if (res.status === 422) return { status: "empty" };
            if (!res.ok) return { status: "error" };
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return { status: "ready", blob, url };
        };

        const load = (src: string) =>
            fetchPreview(src)
                .catch((error): Preview => {
                    if (!signal.aborted) console.error(error);
                    return { status: "error" };
                })
                .then((preview) => {
                    if (signal.aborted) return;
                    if (preview.status === "reconnect") controller.abort();
                    setPreviews((prev) => ({ ...prev, [src]: preview }));
                });

        const [first, ...rest] = key.split(" ");
        load(first).then(() => {
            if (!signal.aborted) rest.forEach(load);
        });

        return () => {
            controller.abort();
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [key]);

    return previews;
}

function Slide({ preview, alt }: { preview: Preview; alt: string }) {
    if (preview.status === "ready") {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- a blob URL, which next/image can't optimize
            <img
                src={preview.url}
                alt={alt}
                className={`${previewSize} rounded-lg`}
            />
        );
    }
    if (preview.status === "empty" || preview.status === "error") {
        return (
            <div
                className={`${previewSize} flex items-center justify-center rounded-lg bg-surface p-6 text-center text-muted`}
            >
                {preview.status === "empty"
                    ? "Not enough listening history yet"
                    : "Couldn’t load your card"}
            </div>
        );
    }
    return (
        <div
            className={`${previewSize} animate-pulse rounded-lg bg-surface-raised`}
            role="status"
            aria-label="Loading card"
        />
    );
}

function Share() {
    const [card, setCard] = useState<Card>("rotation");
    const [active, setActive] = useState(0);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = CARDS.find((c) => c.value === card)!;
    const { ranges, alt, caption, label, description } = current;
    const loaded = usePreviews(CARDS.flatMap((c) => cardSrcs(c, zone)));
    const previews = cardSrcs(current, zone).map(
        (src) => loaded[src] ?? LOADING
    );
    const reconnect = Object.values(loaded).some(
        (p) => p.status === "reconnect"
    );
    const preview = previews[active] ?? LOADING;

    const observeSlides = useCallback((scroller: HTMLDivElement) => {
        scrollerRef.current = scroller;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActive(
                            Number((entry.target as HTMLElement).dataset.index)
                        );
                    }
                }
            },
            { root: scroller, threshold: 0.6 }
        );
        for (const slide of scroller.children) observer.observe(slide);
        return () => {
            observer.disconnect();
            scrollerRef.current = null;
        };
    }, []);

    const showSlide = (index: number) =>
        scrollerRef.current?.children[index]?.scrollIntoView({
            block: "nearest",
            inline: "center",
        });

    const onScrollerKeyDown = (event: KeyboardEvent) => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!step) return;
        event.preventDefault();
        showSlide(Math.min(Math.max(active + step, 0), ranges.length - 1));
    };

    const fileName =
        card === "rotation"
            ? `sentences-rotation-${ranges[active]}.png`
            : `sentences-${card}.png`;
    const file =
        preview.status === "ready"
            ? new File([preview.blob], fileName, { type: "image/png" })
            : null;
    const canShare =
        file !== null && navigator.canShare?.({ files: [file] }) === true;

    return (
        <>
            <Header />
            <div className="content-container flex flex-col items-center gap-6 pb-12">
                <div className={styles.picker} role="group" aria-label="Card">
                    {CARDS.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            className={styles.pick}
                            aria-pressed={card === c.value}
                            aria-label={c.label}
                            onClick={() => {
                                setCard(c.value);
                                setActive(0);
                            }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                aria-hidden="true"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d={c.icon} />
                            </svg>
                            <span>{c.short}</span>
                        </button>
                    ))}
                </div>
                <div className={styles.selected}>
                    <p className={styles.selectedName}>{label}</p>
                    <p className="text-muted">{description}</p>
                </div>

                {reconnect ? (
                    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                        <p className="text-muted">
                            This card needs permission to read your top tracks.
                        </p>
                        <GreenButton
                            text="Reconnect Spotify"
                            onClick={() =>
                                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route, not a page: needs a full navigation to follow its redirect
                                window.location.assign("/api/auth/login")
                            }
                        />
                    </div>
                ) : (
                    <>
                        <div
                            key={card}
                            ref={observeSlides}
                            className={styles.carousel}
                            tabIndex={0}
                            role="region"
                            aria-label="Time ranges"
                            onKeyDown={onScrollerKeyDown}
                        >
                            {ranges.map((range, i) => (
                                <div
                                    key={range}
                                    data-index={i}
                                    data-active={i === active}
                                    className={styles.slide}
                                >
                                    <Slide preview={previews[i]} alt={alt} />
                                </div>
                            ))}
                        </div>

                        {card === "rotation" ? (
                            <div className={styles.caption}>
                                <p className="font-bold" aria-live="polite">
                                    {RANGE_LABELS[ranges[active]]}
                                </p>
                                <div className={styles.dots}>
                                    {ranges.map((range, i) => (
                                        <button
                                            key={range}
                                            type="button"
                                            className={styles.dot}
                                            aria-label={`Show ${RANGE_LABELS[range].toLowerCase()}`}
                                            aria-current={i === active}
                                            onClick={() => showSlide(i)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className={`${styles.caption} text-muted`}>
                                {caption}
                            </p>
                        )}
                    </>
                )}

                {!reconnect && preview.status === "ready" && (
                    <div className="flex flex-wrap justify-center gap-3">
                        <a
                            href={preview.url}
                            download={fileName}
                            className="inline-flex min-h-[3rem] items-center rounded-full border border-[var(--control-border)] px-8 font-bold hover:border-white"
                        >
                            Save image
                        </a>
                        {canShare && (
                            <GreenButton
                                text="Share"
                                onClick={() =>
                                    navigator
                                        .share({ files: [file] })
                                        .catch(() => undefined)
                                }
                            />
                        )}
                    </div>
                )}

                <p className="text-sm text-muted">
                    Shareable cards inspired by{" "}
                    <a
                        href="https://receiptify.herokuapp.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                    >
                        Receiptify
                    </a>{" "}
                    by Michelle Liu
                </p>
            </div>
        </>
    );
}

export default withAuth(Share);
