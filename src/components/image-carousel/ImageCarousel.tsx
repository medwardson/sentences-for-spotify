"use client";

import { FC, ReactNode, useEffect, useState } from "react";

import styles from "./ImageCarousel.module.scss";
import Image from "next/image";
import { Pause, PlayArrow } from "@mui/icons-material";
import { AlbumCover } from "@/types/spotify";
import { combineClasses } from "@/utils/styles";

interface ImageCarouselProps {
    albums: AlbumCover[];
    children?: ReactNode;
    className?: string;
}

const Cover: FC<{ album: AlbumCover; hidden?: boolean }> = ({
    album,
    hidden,
}) => {
    const image = (
        <Image
            width={168}
            height={168}
            className={styles.image}
            src={album.image}
            alt={
                hidden
                    ? ""
                    : album.name
                    ? `${album.name} by ${album.artist}`
                    : "Album cover"
            }
        />
    );

    return (
        <li aria-hidden={hidden || undefined}>
            {album.url ? (
                <a
                    href={album.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={hidden ? -1 : undefined}
                    className={styles.link}
                >
                    {image}
                </a>
            ) : (
                image
            )}
        </li>
    );
};

const ImageCarousel: FC<ImageCarouselProps> = ({
    albums,
    children,
    className,
}) => {
    // undefined until mounted so CSS can honour prefers-reduced-motion before hydration
    const [paused, setPaused] = useState<boolean>();

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia only exists after mount
        setPaused(
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }, []);

    return (
        <section
            aria-label="Album covers"
            className={combineClasses(className, styles.carousel)}
        >
            <div className={styles["carousel-container"]}>
                <ul
                    className={combineClasses(
                        styles["carousel-track"],
                        paused && styles.paused,
                        paused === false && styles.playing
                    )}
                    style={{ animationDuration: `${albums.length * 4}s` }}
                >
                    {albums.map((album, index) => (
                        <Cover key={index} album={album} />
                    ))}
                    {/* Duplicate the covers to create the infinite scroll effect */}
                    {albums.map((album, index) => (
                        <Cover key={index + albums.length} album={album} hidden />
                    ))}
                </ul>
            </div>
            <div className={`content-container ${styles.controls}`}>
                <button
                    type="button"
                    className={styles["pause-button"]}
                    aria-pressed={paused ?? false}
                    aria-label="Pause album carousel"
                    onClick={() => setPaused(!paused)}
                >
                    {paused ? (
                        <PlayArrow fontSize="small" />
                    ) : (
                        <Pause fontSize="small" />
                    )}
                </button>
                {children}
            </div>
        </section>
    );
};

export default ImageCarousel;
