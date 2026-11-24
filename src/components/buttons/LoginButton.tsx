"use client";

import { login } from "@/utils/spotifyAuth";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import GreenButton from "./GreenButton";

export const LoginButton = () => {
    const router = useRouter();

    function handleLogin() {
        const existingAccessToken = Cookies.get("access_token");

        if (existingAccessToken) {
            router.push("/loading");
            return;
        }

        login();
    }

    return <GreenButton text="Login with Spotify" onClick={handleLogin} />;
};
