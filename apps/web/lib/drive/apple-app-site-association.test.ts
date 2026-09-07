import { describe, expect, it } from "vitest";

import {
  INVOICEY_DRIVE_APP_ID,
  INVOICEY_DRIVE_TEAM_ID,
  appleAppSiteAssociation,
} from "./apple-app-site-association";

describe("appleAppSiteAssociation", () => {
  it("claims the Drive pairing callback for the registered Team ID", () => {
    expect(INVOICEY_DRIVE_TEAM_ID).toBe("72T6DX5YZU");
    expect(INVOICEY_DRIVE_APP_ID).toBe("72T6DX5YZU.me.ditrich.invoicey.drive");
    expect(appleAppSiteAssociation.applinks.details[0]?.appIDs).toEqual([
      INVOICEY_DRIVE_APP_ID,
    ]);
    const paths = appleAppSiteAssociation.applinks.details[0]?.components.map(
      (component) => component["/"],
    );
    expect(paths).toContain("/drive/oauth");
    expect(paths).not.toContain("/drive/connect");
  });
});
