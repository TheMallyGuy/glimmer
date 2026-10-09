

export class FleasionPreset {

    /* de-vng fastflags */
    static async deVng() {
        return {
            // chat keys
            DFLogAlternateChatKey13OrOverVng: true,
            DFLogAlternateChatKeyUnder13Vng: true,

            FFlagEnableVNGDUARSignupCompliance3: false,
            FFlagEnableVNGNewAppAvailableModal: false,
            FFlagEnableVNGStartPurchaseAfterInGameFlowIOS: false,
            FFlagLuaAppHomeVngAppUpsell: false,
            FFlagOpenVngTosForVngRobuxUpsell: false,
            FFlagPaymentsProtocoliOSVNGOnly: false,
            FFlagPaymentsProtocoliOSVNGOnly2: false,
            FFlagUseUpdatedVNGAgreementsWorkflow: false,
            FFlagVngAppUpsellPcLayout: false,
            FFlagVngLogoutGlobalAppSessionsOnConversion: false,
            FFlagVngTOSRevisedEnabled: false,

            FStringVNGWebshopUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            FStringVngAppUpsellUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }
    }
}


export async function hiddenFlags(fleasion: { enabled: boolean; settings: { deVng: boolean } }): Promise<Record<string, string>> {
    if (!fleasion.enabled) return {};

    const flags: Record<string, string> = {};
    if (fleasion.settings.deVng) {
        for (const [name, value] of Object.entries(await FleasionPreset.deVng())) flags[name] = String(value);
    }
    return flags;
}
