import logo from "../../public/images/newLogo.svg";

import styles from "@/app/page.module.scss";
import { LoginButton } from "@/components/buttons/LoginButton";
import ImageCarousel from "@/components/image-carousel/ImageCarousel";
import SpotifyAttribution from "@/components/spotify-attribution/SpotifyAttribution";
import { AlbumCover } from "@/types/spotify";
import { db } from "@/utils/firebaseAdmin";
import Image from "next/image";

export const revalidate = 86400;

const steps = [
    "Log in with Spotify.",
    "Type a sentence and pick a playlist title.",
    "We build a playlist whose song titles spell it out.",
];

export default async function Home() {
    const doc = await db.collection("albums").doc("albums").get();
    // docs written before the cron moved to objects hold bare cover URLs
    const albums: AlbumCover[] = (doc.data()?.albums ?? []).map(
        (album: AlbumCover | string) =>
            typeof album === "string" ? { image: album } : album
    );

    return (
        <div className={styles.page}>
            <section className={`content-container ${styles.hero}`}>
                <Image
                    className={styles.logo}
                    src={logo}
                    alt="Sentences for Spotify logo"
                    priority
                />
                <div className={styles.heroText}>
                    <h1 className={styles.title}>Sentences for Spotify</h1>
                    <p className={styles.subtitle}>
                        Turn any sentence into a playlist whose song titles
                        spell it out.
                    </p>
                    <LoginButton />
                </div>
            </section>

            <section className={`content-container ${styles.steps}`}>
                <h2 className="section-heading">How it works</h2>
                <ol className={styles.stepList}>
                    {steps.map((step, i) => (
                        <li key={step} className={styles.step}>
                            <span className={styles.stepNumber}>{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </section>

            {albums.length > 0 && (
                <ImageCarousel albums={albums}>
                    <SpotifyAttribution />
                </ImageCarousel>
            )}
        </div>
    );
}
