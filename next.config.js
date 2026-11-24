/** @type {import('next').NextConfig} */
const nextConfig = {
    // Spotify only accepts 127.0.0.1 (not localhost) as a local redirect URI
    allowedDevOrigins: ["127.0.0.1"],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "i.scdn.co",
                port: "",
                pathname: "/image/**",
            },
        ],
    },
};

module.exports = nextConfig;
