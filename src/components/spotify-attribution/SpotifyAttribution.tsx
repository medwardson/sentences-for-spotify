import Image from "next/image";

const PLAYLIST_URL = "https://open.spotify.com/playlist/37i9dQZEVXbLRQDuF5jeBp";

export default function SpotifyAttribution() {
    return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>Album art and data from</span>
            <Image
                src="/images/spotify-full-logo-white.svg"
                alt="Spotify"
                width={80}
                height={22}
            />
            <a
                href={PLAYLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
            >
                Listen on Spotify
            </a>
        </p>
    );
}
