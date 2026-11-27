// re-exported first so querySlice, which imports Mode from here, never sees it undefined
export { Mode } from "@/types/query";
import { Mode } from "@/types/query";
import GreenButton from "@/components/buttons/GreenButton";
import { TextInput } from "@/components/inputs/TextInput";
import styles from "@/components/search/options/Options.module.scss";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
    clearQuery,
    setFetching,
    setMode,
    setSentence,
    setTitle,
} from "@/lib/store/querySlice";
import { addRecentResult } from "@/lib/store/userSlice";
import { SearchResult } from "@/types/spotify";
import SpotifyClient from "@/utils/spotify";
import { combineClasses } from "@/utils/styles";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { FC, FormEvent, useId, useMemo } from "react";

const modeHelp: Record<Mode, string> = {
    [Mode.SHORT]: "One song per word where possible; longer titles fill the gaps",
    [Mode.LONG]: "Tries the longest matching titles first",
};

interface OptionsProps {
    className?: string;
}

export const Options: FC<OptionsProps> = ({ className }) => {
    const dispatch = useAppDispatch();
    const helpId = useId();
    const { sentence, title, mode, isFetching } = useAppSelector(
        (state) => state.query
    );
    const { id, accessToken } = useAppSelector((state) => state.user.info);

    const client = useMemo(
        () => (accessToken ? new SpotifyClient(accessToken) : undefined),
        [accessToken]
    );
    if (!client || !id) return;

    const disabled = sentence.length === 0 || title.length === 0 || isFetching;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (disabled) return;

        dispatch(setFetching(true));
        client
            .startCreationAttempt(sentence, title, mode)
            .then((sr: SearchResult) => {
                dispatch(addRecentResult({ sr }));
                dispatch(clearQuery());
            })
            .catch((err: any) => {
                console.error(err);
                dispatch(setFetching(false));
            });
    };

    return (
        <form
            onSubmit={submit}
            className={combineClasses(className, styles.form)}
        >
            <TextInput
                label="Playlist title"
                placeholder="Road trip mix"
                value={title}
                onChange={(value) => dispatch(setTitle(value))}
            />

            <TextInput
                label="Sentence"
                placeholder="never gonna give you up"
                value={sentence}
                onChange={(value) => dispatch(setSentence(value))}
            />

            <div className={styles.mode}>
                <ToggleButtonGroup
                    value={mode}
                    exclusive
                    onChange={(_, newMode) => {
                        if (newMode !== null) {
                            dispatch(setMode(newMode));
                        }
                    }}
                    aria-label="Song title length"
                    aria-describedby={helpId}
                    className={styles["toggle-group"]}
                >
                    <ToggleButton
                        size="small"
                        value={Mode.SHORT}
                        classes={{
                            root: styles.toggle,
                            selected: styles.selected,
                        }}
                    >
                        Short Titles
                    </ToggleButton>
                    <ToggleButton
                        size="small"
                        value={Mode.LONG}
                        classes={{
                            root: styles.toggle,
                            selected: styles.selected,
                        }}
                    >
                        Long Titles
                    </ToggleButton>
                </ToggleButtonGroup>
                <p id={helpId} className={styles.help}>
                    {modeHelp[mode]}
                </p>
            </div>

            <div className={styles.actions}>
                <GreenButton
                    type="submit"
                    text={isFetching ? "Creating…" : "Create playlist"}
                    disabled={disabled}
                />
            </div>
        </form>
    );
};
