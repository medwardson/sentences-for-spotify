import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Analytics } from "@vercel/analytics/react";
import MuiProvider from "./MuiProvider";
import StoreProvider from "./StoreProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "Sentences for Spotify",
    description:
        "Turn a sentence into a Spotify playlist whose song titles spell it out.",
};

interface RootLayoutProps {
    children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${inter.className}`}>
                <MuiProvider>
                    <StoreProvider>
                        <main className="min-h-screen w-full">{children}</main>
                    </StoreProvider>
                </MuiProvider>
                <Analytics />
            </body>
        </html>
    );
}
