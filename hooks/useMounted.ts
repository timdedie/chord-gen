import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** True once hydrated on the client; false during SSR and the first client render. */
export function useMounted() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
