"use client";

import styles from "./GreenButton.module.scss";

interface GreenButtonProps {
    text: string;
    onClick?: () => any;
    type?: "button" | "submit";
    disabled?: boolean;
}

export default function GreenButton({
    text,
    onClick,
    type = "button",
    disabled,
}: GreenButtonProps) {
    return (
        <button
            className={styles["green-button"]}
            type={type}
            onClick={onClick}
            disabled={disabled}
        >
            {text}
        </button>
    );
}
