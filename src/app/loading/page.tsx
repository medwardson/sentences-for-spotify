"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { sendData } from "@/utils/database";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setUserInfo } from "@/lib/store/userSlice";
import { fetchSpotifyUserData } from "@/utils/getUserInfo";
import { CircularProgress } from "@mui/material";
import { getAccessToken } from "@/utils/spotifyAuth";
import Image from "next/image";
import logo from "../../../public/images/newLogo.svg";

function Main() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const ran = useRef(false);

    const { accessToken } = useAppSelector((state) => state.user.info);

    const getUserInfo = useCallback(
        async (accessToken: string) => {
            const fetchData = async () => {
                try {
                    const data = await fetchSpotifyUserData(accessToken);

                    dispatch(
                        setUserInfo({
                            id: data.id,
                            displayName: data.display_name,
                            accessToken: accessToken,
                            profilePictureUrl: data.images?.at(-1)?.url,
                        })
                    );
                    // Optional: Call sendData if needed
                    sendData(accessToken);
                    router.push("/home");
                } catch (error) {
                    router.push("/");
                }
            };
            fetchData();
        },
        [dispatch, router]
    );

    useEffect(() => {
        if (accessToken) {
            router.push("/home");
            return;
        }

        const cookieToken = Cookies.get("access_token");

        if (cookieToken) {
            getUserInfo(cookieToken);
            return;
        }

        const code = new URLSearchParams(window.location.search).get("code");

        if (!code) {
            router.push("/");
            return;
        }

        // only the one-time code exchange is guarded, so redirects still fire on Strict Mode's effect re-run
        if (ran.current) return;
        ran.current = true;

        getAccessToken(code)
            .then((token) => {
                if (token) getUserInfo(token);
                else router.push("/");
            })
            .catch(() => router.push("/"));
    }, [accessToken, getUserInfo, router]);

    return (
        <div className="flex min-h-[100svh] w-full items-center justify-center p-6">
            <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-6 text-center"
            >
                <Image
                    src={logo}
                    alt=""
                    width={72}
                    height={72}
                    priority
                    className="rounded-lg"
                />
                <CircularProgress size={32} thickness={4} />
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold">Signing you in</h1>
                    <p className="text-muted">
                        Connecting to your Spotify account&hellip;
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Main;
