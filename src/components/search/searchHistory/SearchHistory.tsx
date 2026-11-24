"use client";

import { SearchResult } from "@/types/spotify";

import styles from "./SearchHistory.module.scss";
import React, { useEffect, useState } from "react";

const PAGE_SIZE = 10;

interface SearchHistoryProps {
    title: string;
    results: SearchResult[];
}

export default function SearchHistory({ title, results }: SearchHistoryProps) {
    const [page, setPage] = useState(1);
    const pageCount = Math.ceil(results.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to page 1 when the results change
    useEffect(() => setPage(1), [results.length]);

    return (
        <section className="flex flex-col gap-4">
            <h2 className="section-heading">
                {title}
                {results.length > 0 && ` · ${results.length}`}
            </h2>

            {results.length > 0 ? (
                <>
                    <ul
                        className={`${styles.list} ${pageCount > 1 ? styles.paged : ""}`}
                        style={{ "--page-size": PAGE_SIZE } as React.CSSProperties}
                    >
                        {results.slice(start, start + PAGE_SIZE).map((result, i) => (
                            <li key={start + i} className={styles.item}>
                                <div className={styles.text}>
                                    <span className={styles.title} title={result.title}>
                                        {result.title}
                                    </span>
                                    {result.sentence && (
                                        <span
                                            className={styles.sentence}
                                            title={result.sentence}
                                        >
                                            {result.sentence}
                                        </span>
                                    )}
                                </div>
                                {result.status === "success" ? (
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Open ${result.title} on Spotify`}
                                        className={`text-link text-sm ${styles.action}`}
                                    >
                                        Open
                                    </a>
                                ) : (
                                    <span
                                        className={`text-sm text-red-400 ${styles.action}`}
                                        title="No song combination found"
                                    >
                                        No match
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>

                    {pageCount > 1 && (
                        <nav aria-label="History pages" className={styles.pager}>
                            <button
                                type="button"
                                className="text-link text-sm"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </button>
                            <span className="text-muted text-sm">
                                Page {page} of {pageCount}
                            </span>
                            <button
                                type="button"
                                className="text-link text-sm"
                                disabled={page === pageCount}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </button>
                        </nav>
                    )}
                </>
            ) : (
                <div className="text-muted">
                    <p>No playlists yet.</p>
                    <p>Try: &ldquo;here comes the sun&rdquo;</p>
                </div>
            )}
        </section>
    );
}
