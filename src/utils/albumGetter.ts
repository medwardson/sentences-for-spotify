import { AlbumCover } from "@/types/spotify";

const client_id = process.env.NEXT_PUBLIC_CLIENT_ID;
const client_secret = process.env.NEXT_CLIENT_SECRET;

const authOptions = {
    method: "POST",
    headers: {
        Authorization: `Basic ${Buffer.from(
            `${client_id}:${client_secret}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
        grant_type: "client_credentials",
    }),
};

class AlbumGetter {
    private token: string = "";

    public async getAlbums() {
        try {
            const response = await fetch(
                "https://api.spotify.com/v1/playlists/37i9dQZEVXbLRQDuF5jeBp/items",
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                }
            );
            if (response.ok) {
                const data = await response.json();

                const seenAlbumIds = new Set<string>();
                const albums: AlbumCover[] = [];

                for (const item of data.items) {
                    const album = item.item?.album;
                    if (!album || seenAlbumIds.has(album.id)) continue;
                    seenAlbumIds.add(album.id);

                    const largestImage = [...album.images].sort(
                        (a: any, b: any) => b.height - a.height
                    )[0];
                    if (!largestImage) continue;

                    albums.push({
                        image: largestImage.url,
                        url: album.external_urls.spotify,
                        name: album.name,
                        artist: album.artists[0]?.name,
                    });
                    // Spotify's guidelines cap a content shelf at 20 items
                    if (albums.length === 20) break;
                }

                return albums;
            } else {
                console.error(
                    "Failed to retrieve albums",
                    response.status,
                    response.statusText
                );
            }
        } catch (error) {
            console.error("Error fetching albums:", error);
        }
    }

    async getToken() {
        try {
            const response = await fetch(
                "https://accounts.spotify.com/api/token",
                authOptions
            );
            if (response.ok) {
                const data = await response.json();
                const token = data.access_token;
                this.token = token;
                return token;
            } else {
                console.error(
                    "Failed to retrieve token",
                    response.status,
                    response.statusText
                );
            }
        } catch (error) {
            console.error("Error fetching token:", error);
        }
    }
}

export default AlbumGetter;
