/** Apple Developer Team ID for Invoicey Drive (Individual: FILIP DITRICH). */
export const INVOICEY_DRIVE_TEAM_ID = "72T6DX5YZU";

/** App ID as AASA `TEAMID.bundle`. */
export const INVOICEY_DRIVE_APP_ID =
  `${INVOICEY_DRIVE_TEAM_ID}.me.ditrich.invoicey.drive` as const;

/**
 * Universal Links for the Drive pairing callback only.
 * `/drive/connect` stays in the browser so the user can confirm the device.
 */
export const appleAppSiteAssociation = {
  applinks: {
    details: [
      {
        appIDs: [INVOICEY_DRIVE_APP_ID],
        components: [
          {
            "/": "/drive/oauth",
            comment: "Invoicey Drive pairing callback",
          },
          {
            "/": "/drive/oauth/*",
          },
        ],
      },
    ],
  },
} as const;
