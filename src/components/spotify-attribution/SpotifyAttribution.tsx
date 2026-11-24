const PLAYLIST_URL = "https://open.spotify.com/playlist/37i9dQZEVXbLRQDuF5jeBp";

export default function SpotifyAttribution() {
    return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {/* official Spotify logo goes here once the owner approves the asset */}
            <span>Album art and data from Spotify</span>
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
