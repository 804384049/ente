import { accountLogout } from "@/accounts/services/logout";
import DownloadManager from "@/new/photos/services/download";
import { clearFeatureFlagSessionState } from "@/new/photos/services/feature-flags";
import { logoutML, terminateMLWorker } from "@/new/photos/services/ml";
import log from "@/next/log";
import { clipService } from "services/clip-service";
import exportService from "./export";

/**
 * Logout sequence for the photos app.
 *
 * This function is guaranteed not to throw any errors.
 *
 * See: [Note: Do not throw during logout].
 */
export const photosLogout = async () => {
    const ignoreError = (label: string, e: unknown) =>
        log.error(`Ignoring error during logout (${label})`, e);

    // - Workers

    // Terminate any workers before clearing persistent state.
    // See: [Note: Caching IDB instances in separate execution contexts].

    try {
        terminateMLWorker();
    } catch (e) {
        ignoreError("face", e);
    }

    // - Remote logout and clear state

    await accountLogout();

    // - Photos specific logout

    try {
        clearFeatureFlagSessionState();
    } catch (e) {
        ignoreError("feature-flag", e);
    }

    try {
        DownloadManager.logout();
    } catch (e) {
        ignoreError("download", e);
    }

    try {
        await clipService.logout();
    } catch (e) {
        ignoreError("CLIP", e);
    }

    // - Desktop

    const electron = globalThis.electron;
    if (electron) {
        try {
            await logoutML();
        } catch (e) {
            ignoreError("ML", e);
        }

        try {
            exportService.disableContinuousExport();
        } catch (e) {
            ignoreError("export", e);
        }

        try {
            await electron.logout();
        } catch (e) {
            ignoreError("electron", e);
        }
    }
};
