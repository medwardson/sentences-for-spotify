"use client";

import GreenButton from "@/components/buttons/GreenButton";
import { Header } from "@/components/home/header/Header";
import withAuth from "@/components/useAuth";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.scss";

type Card = "rotation" | "eras";
type Range = "short_term" | "medium_term" | "long_term";

const CARDS: { value: Card; label: string; alt: string; ranges: Range[] }[] = [
    {
        value: "rotation",
        label: "Heavy Rotation",
        alt: "Card showing your most-played songs as magnet tiles",
        ranges: ["short_term", "medium_term", "long_term"],
    },
    {
        value: "eras",
        label: "Eras",
        alt: "Card showing how old your ears are, with your top songs by decade",
        ranges: ["long_term"],
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

function usePreviews(srcs: string[]): Preview[] {
    const key = srcs.join(" ");
    const [loaded, setLoaded] = useState<{
        key: string;
        previews: Record<string, Preview>;
    }>();

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const urls: string[] = [];
        let refreshing: Promise<unknown> | undefined;

        for (const src of key.split(" ")) {
            const setPreview = (preview: Preview) =>
                setLoaded((prev) => ({
                    key,
                    previews: {
                        ...(prev?.key === key ? prev.previews : {}),
                        [src]: preview,
                    },
                }));

            const load = async () => {
                let res = await fetch(src, { signal });
                if (res.status === 401) {
                    // the access_token cookie expired; the session route refreshes it, once for all slides
                    refreshing ??= fetch("/api/auth/session", { signal });
                    await refreshing;
                    res = await fetch(src, { signal });
                }
                if (res.status === 403)
                    return setPreview({ status: "reconnect" });
                if (res.status === 422) return setPreview({ status: "empty" });
                if (!res.ok) return setPreview({ status: "error" });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                urls.push(url);
                setPreview({ status: "ready", blob, url });
            };
            load().catch((error) => {
                if (!signal.aborted) {
                    console.error(error);
                    setPreview({ status: "error" });
                }
            });
        }

        return () => {
            controller.abort();
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [key]);

    return srcs.map(
        (src) => (loaded?.key === key && loaded.previews[src]) || LOADING
    );
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

    const { ranges, alt } = CARDS.find((c) => c.value === card)!;
    const srcs = ranges.map((range) =>
        card === "rotation"
            ? `/api/share/rotation?range=${range}`
            : "/api/share/eras"
    );
    const previews = usePreviews(srcs);
    const reconnect = previews.some((p) => p.status === "reconnect");
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
            : "sentences-eras.png";
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
                <div className={styles.tabs} role="group" aria-label="Card">
                    {CARDS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            className={styles.tab}
                            aria-pressed={card === value}
                            onClick={() => {
                                setCard(value);
                                setActive(0);
                            }}
                        >
                            {label}
                        </button>
                    ))}
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
                                Based on your last year
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
