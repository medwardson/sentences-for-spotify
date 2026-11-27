import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { deleteDataConfirmation, deleteDataCookie } from "@/utils/auth";
import { getSpotifyUser } from "@/utils/requireSpotifyUser";
import styles from "../accountPages.module.scss";

export const metadata: Metadata = { title: "Delete your data | Sentences for Spotify" };

type Props = { searchParams: Promise<{ status?: string | string[] }> };

export default async function DeleteDataPage({ searchParams }: Props) {
    const { status } = await searchParams;
    if (status === "deleted") {
        return (
            <main className={`content-container ${styles.page}`}>
                <h1>Data deleted</h1>
                <p role="status">Your Sentences for Spotify data for the verified account was deleted. Your playlists are still in Spotify.</p>
                <Link href="/" className="text-link">Return home</Link>
            </main>
        );
    }

    const token = (await cookies()).get(deleteDataCookie)?.value;
    const account = token ? await getSpotifyUser(token).catch(() => null) : null;
    const signInUrl = "/api/auth/login?intent=delete-data";

    return (
        <main className={`content-container ${styles.page}`}>
            <Link href="/terms" className="text-link">Terms of service</Link>
            <h1>Delete your data</h1>
            <p>Verify your Spotify account to permanently remove the data Sentences for Spotify stores for it.</p>
            <ul>
                <li>Website profile and playlist history</li>
                <li>Saved listening data used for Stats</li>
                <li>ChatGPT plugin connections and their sign-in records</li>
            </ul>
            <p>Your Spotify account and the playlists in it stay in Spotify. Using Sentences for Spotify again can create new records.</p>

            {(status === "sign-in-required" || status === "sign-in-failed" || (token && !account)) && (
                <p role="alert">We couldn’t verify your Spotify account. Sign in to try again.</p>
            )}
            {status === "review-again" && <p role="alert">Your sign-in changed. Review the account shown before confirming.</p>}
            {status === "retry" && <p role="alert">We couldn’t confirm all of your data was deleted. You can safely try again.</p>}

            {account && token ? (
                <form action="/delete-data/confirm" method="post" className={styles.actions}>
                    <p>Verified Spotify account: <strong>{account.display_name || account.id}</strong></p>
                    <input type="hidden" name="confirmation" value={deleteDataConfirmation(token)} />
                    <button type="submit" className={styles.deleteButton}>Permanently delete my data</button>
                    <a href={signInUrl} className="text-link">Verify a different Spotify account</a>
                </form>
            ) : (
                <a href={signInUrl} className={styles.signInButton}>Verify with Spotify</a>
            )}
        </main>
    );
}
