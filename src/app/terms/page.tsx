import type { Metadata } from "next";
import Link from "next/link";
import styles from "../accountPages.module.scss";

export const metadata: Metadata = { title: "Terms of service | Sentences for Spotify" };

export default function TermsPage() {
    return (
        <main className={`content-container ${styles.page}`}>
            <Link href="/" className="text-link">Sentences for Spotify</Link>
            <h1>Terms of service</h1>
            <p>These terms apply to the Sentences for Spotify website and ChatGPT plugin, operated by Mesha Edwardson.</p>

            <h2>Using Sentences for Spotify</h2>
            <p>When you ask us to create a playlist, you authorize the service to search for matching tracks and save a new playlist to the Spotify account you connected. Matching depends on Spotify’s catalog and availability.</p>
            <p>Website playlists can appear on your Spotify profile. Playlists made through ChatGPT stay off your profile and out of search, and anyone with the link can open them. Choose <strong>Make private</strong> in Spotify to restrict access.</p>
            <p>The website also offers listening stats and shareable cards. Review a card before sharing it because it can show your listening activity.</p>
            <p>Use the service lawfully and follow the applicable Spotify and OpenAI terms. You may not modify or create derivative works from Spotify’s platform, service, or content, or reverse engineer, decompile, disassemble, or otherwise convert them into source code or a human-readable form, to the extent the law permits these restrictions.</p>

            <h2>Responsibility and Spotify</h2>
            <p>Mesha Edwardson is responsible for operating Sentences for Spotify. To the fullest extent permitted by law, we make no representations or warranties on Spotify’s behalf and disclaim implied warranties of merchantability, fitness for a particular purpose, and noninfringement for Spotify’s platform, service, and content. Spotify and other third parties have no liability for Sentences for Spotify to the extent permitted by law. Your mandatory consumer rights continue to apply.</p>
            <p>Spotify is a third-party beneficiary of these terms and our privacy policy and may enforce these terms directly.</p>

            <h2>Delete your data</h2>
            <p><Link href="/delete-data" className="text-link">Delete your Sentences for Spotify data</Link> by verifying your Spotify account and confirming the deletion. This removes stored website and ChatGPT plugin data for the verified account. Your Spotify playlists remain in Spotify.</p>
        </main>
    );
}
