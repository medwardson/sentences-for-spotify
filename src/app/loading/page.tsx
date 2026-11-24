"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPlaylistHistory, sendData } from "@/utils/database";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setFullHistory, setUserInfo } from "@/lib/store/userSlice";
import { fetchSpotifyUserData } from "@/utils/getUserInfo";
import { CircularProgress } from "@mui/material";
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
                    const [data, history] = await Promise.all([
                        fetchSpotifyUserData(accessToken),
                        getPlaylistHistory(accessToken).catch(() => null),
                    ]);

                    // Firestore arrayUnion appends, so the newest playlist is last
                    if (history) dispatch(setFullHistory(history.reverse()));
                    dispatch(
                        setUserInfo({
                            id: data.id,
                            displayName: data.display_name,
                            accessToken: accessToken,
                            profilePictureUrl: data.images?.at(-1)?.url,
                        })
                    );
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

        // only the one-shot session fetch is guarded, so the redirect above still fires on Strict Mode's effect re-run
        if (ran.current) return;
        ran.current = true;

        fetch("/api/auth/session")
            .then((response) => (response.ok ? response.json() : null))
            .then((session) => {
                if (session?.accessToken) getUserInfo(session.accessToken);
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
