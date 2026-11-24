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
                    sendData(data.id, data.display_name);
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
        // Prevent double running this as the code is only valid once
        if (ran.current) return;
        ran.current = true;

        if (accessToken) {
            router.push("/home");
            return;
        }

        const cookieToken = Cookies.get("access_token");

        if (cookieToken) {
            getUserInfo(cookieToken);
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
            getAccessToken(code)
                .then((token) => {
                    if (token) getUserInfo(token);
                    else router.push("/");
                })
                .catch(() => router.push("/"));
        } else {
            router.push("/");
        }
    }, [accessToken, getUserInfo, router]);

    return (
        <div className="flex flex-col items-center p-4 w-full h-full">
            <div className="flex flex-col items-center justify-center gap-4 h-1/2">
                <h1 className="page-title">Loading...</h1>
                <CircularProgress />
            </div>
        </div>
    );
}

export default Main;
