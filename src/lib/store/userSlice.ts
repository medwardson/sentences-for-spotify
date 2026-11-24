import { SearchResult } from "@/types/spotify";
import { User } from "@/types/user";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState: User = {
    info: {
        id: undefined,
        displayName: undefined,
        accessToken: undefined,
        profilePictureUrl: undefined,
    },
    recentResults: [],
    fullHistory: [],
    historyLoaded: false,
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUserInfo: (
            state,
            action: PayloadAction<{
                id: string;
                displayName: string;
                accessToken: string;
                profilePictureUrl?: string;
            }>
        ) => {
            state.info.id = action.payload.id;
            state.info.accessToken = action.payload.accessToken;
            state.info.displayName = action.payload.displayName;
            state.info.profilePictureUrl = action.payload.profilePictureUrl;
        },
        clearUserInfo: () => {
            return initialState;
        },
        setAccessToken: (state, action: PayloadAction<string>) => {
            state.info.accessToken = action.payload;
        },
        addRecentResult: (
            state,
            action: PayloadAction<{ sr: SearchResult }>
        ) => {
            state.recentResults.unshift(action.payload.sr);

            if (state.historyLoaded) state.fullHistory.unshift(action.payload.sr);
        },
        setFullHistory: (state, action: PayloadAction<SearchResult[]>) => {
            const saved = new Set(action.payload.map((sr) => sr.url));
            // results made before the load finished may not be saved yet, and failures never are
            state.fullHistory = [
                ...state.recentResults.filter(
                    (sr) => !sr.url || !saved.has(sr.url)
                ),
                ...action.payload,
            ];
            state.historyLoaded = true;
        },
    },
});

export const {
    setUserInfo,
    clearUserInfo,
    setAccessToken,
    addRecentResult,
    setFullHistory,
} = userSlice.actions;

export default userSlice.reducer;
