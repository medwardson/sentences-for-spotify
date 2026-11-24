export enum Mode {
    SHORT = "short",
    LONG = "long",
}

export interface Query {
    title: string;
    sentence: string;
    mode: Mode;
    isFetching: boolean;
}
