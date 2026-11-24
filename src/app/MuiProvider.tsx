"use client";

import {
    StyledEngineProvider,
    ThemeProvider,
    createTheme,
} from "@mui/material/styles";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#1ed760", contrastText: "#121212" },
        background: { default: "#121212", paper: "#282828" },
        text: { primary: "#ffffff", secondary: "#b3b3b3" },
    },
    typography: { fontFamily: "var(--font-inter), sans-serif" },
});

export default function MuiProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // injectFirst lets CSS modules override MUI without !important
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </StyledEngineProvider>
    );
}
