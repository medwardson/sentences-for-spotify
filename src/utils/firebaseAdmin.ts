import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
}

if (!getApps().length) {
    const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString(
            "ascii"
        )
    );
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL,
    });
}

export const db = getFirestore();
