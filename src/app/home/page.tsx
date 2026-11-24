"use client";

import styles from "@/app/home/page.module.scss";

import { Header } from "@/components/home/header/Header";
import { Options } from "@/components/search/options/Options";
import SearchHistory from "@/components/search/searchHistory/SearchHistory";
import withAuth from "@/components/useAuth";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setFullHistory } from "@/lib/store/userSlice";
import { getPlaylistHistory } from "@/utils/database";
import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";

function Main() {
    const dispatch = useAppDispatch();
    const { info, recentResults, fullHistory, historyLoaded } = useAppSelector(
        (state) => state.user
    );
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (historyLoaded || !info.accessToken) return;
        getPlaylistHistory(info.accessToken)
            // Firestore arrayUnion appends, so the newest playlist is last
            .then((history) => dispatch(setFullHistory(history.reverse())))
            .catch(() => setLoadFailed(true));
    }, [dispatch, historyLoaded, info.accessToken]);

    return (
        <>
            <Header />
            <div className={`content-container ${styles.content}`}>
                <Options />
                {historyLoaded || loadFailed ? (
                    <div className="flex flex-col gap-2">
                        <SearchHistory
                            title="History"
                            results={historyLoaded ? fullHistory : recentResults}
                        />
                        {loadFailed && (
                            <p className="text-muted text-sm">
                                Couldn&rsquo;t load your saved playlists
                            </p>
                        )}
                    </div>
                ) : (
                    <CircularProgress size={24} className="justify-self-center" />
                )}
            </div>
        </>
    );
}

export default withAuth(Main);
