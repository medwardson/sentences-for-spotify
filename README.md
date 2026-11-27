# Sentences for Spotify

Creates a playlist that spells out the desired sentence.

Example:
"I want to dance with somebody" --> https://open.spotify.com/playlist/7JOtXgULowB5PlVYURBBFT

Steps:

1. Login through homepage using your Spotify Account
2. Enter the sentence you wish to transform.
    - It is suggested that you try to avoid punctuation. Although there is
      some preventative measures in place, best results will come with no
      punctuation.
    - Consider that not all words exist in a song title.
3. Choose a playlist title.
4. If the titles are found, you will get a link to the playlist.

## MCP prototype

Run `npm install` and `npm run dev`. In MCP Inspector (`npx @modelcontextprotocol/inspector`),
choose **Streamable HTTP** and connect to `http://localhost:8000/mcp`.
Call `preview_sentence_playlist` with:

```json
{"sentence":"We glow again","title":"After Hours","mode":"long"}
```

The long-mode preview returns **We Glow → Again**. With `"mode":"short"`, it
returns **We → Glow → Again**. The preview uses a small fictional catalog and
makes no Spotify API calls or playlist writes.

To test in ChatGPT, make the endpoint reachable via HTTPS or Secure MCP Tunnel.
In **ChatGPT Plugins**, choose **Add custom MCP server**, connect the endpoint
with authentication set to **No authentication**, and select **Create as a plugin**.
Try asking “Preview a playlist titled After Hours that spells ‘We glow again’
using long titles.” Custom MCP access depends on your account and workspace settings.

### Spotify account linking beta

The beta exposes `spotify_connection_status` to connect a Spotify account from
ChatGPT and check its connection. Each user's authorization is tied to the
Spotify account they approve during sign-in. This milestone covers account linking.

Deploy the Next.js app on HTTPS with its existing Spotify and Firebase
configuration and these additional server environment variables:

| Variable | Value |
| --- | --- |
| `MCP_OAUTH_ORIGIN` | The deployment's HTTPS origin, without a trailing slash |
| `MCP_OAUTH_CLIENT_ID` | The predefined OAuth client ID entered in ChatGPT |
| `MCP_OAUTH_REDIRECT_URI` | The exact ChatGPT redirect URI shown in the connection setup |
| `MCP_SPOTIFY_TOKEN_KEY` | A server-only 32-byte key encoded in Base64 |

Register `https://<host>/api/mcp/oauth/callback` as a redirect URI in the
existing Spotify app. Configure the custom MCP connection for OAuth with the
predefined client ID, token endpoint authentication method `none`, and
`spotify:link` scope. Spotify consent requests private playlist permission
for the linked account.

Set Firestore TTL policies on the `expiresAt` field in the
`mcpSpotifyOAuth` and `mcpSpotifyLinks` collection groups to clean up expired
grants and links. The server checks expiration before accepting a grant.

In ChatGPT, ask the beta plugin to connect Spotify. After approving on Spotify,
start a new chat and ask the plugin whether Spotify is connected. To test account
isolation, repeat the flow from a separate ChatGPT account with a different
Spotify account.

# Original Versions

https://github.com/medwardson/spotifysentences
http://medwardson.ca/spotifysentences
