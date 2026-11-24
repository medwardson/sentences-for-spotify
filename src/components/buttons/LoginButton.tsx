"use client";

import GreenButton from "./GreenButton";

export const LoginButton = () => {
    function handleLogin() {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route, not a page: needs a full navigation to follow its redirect
        window.location.assign("/api/auth/login");
    }

    return <GreenButton text="Log in with Spotify" onClick={handleLogin} />;
};
