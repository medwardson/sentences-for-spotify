import React, { FC, useId } from "react";

import styles from "./TextInput.module.scss";
import { combineClasses } from "@/utils/styles";

interface TextInputProps {
    label: string;
    placeholder: string;
    onChange: (input: string) => void;
    value: string;
    className?: string;
}

export const TextInput: FC<TextInputProps> = ({
    label,
    placeholder,
    onChange,
    value,
    className,
}) => {
    const id = useId();

    return (
        <div className={combineClasses(className, styles["input-container"])}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            <input
                id={id}
                type="text"
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={styles.input}
                value={value}
            />
        </div>
    );
};
