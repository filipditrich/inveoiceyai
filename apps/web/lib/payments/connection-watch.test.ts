import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { connectionIsNotWatched } from "./connection-watch";

describe("connectionIsNotWatched", () => {
  it("keeps connections whose watch was never started in the cron sweep", () => {
    const dialect = new PgDialect();
    const predicate = connectionIsNotWatched(
      new Date("2026-09-08T10:00:00.000Z"),
    );
    if (!predicate) expect.fail("watch predicate must always be defined");
    const query = dialect.sqlToQuery(predicate.getSQL());

    expect(query.sql).toContain('"watch_until" is null');
    expect(query.sql).toContain('"watch_until" <=');
  });
});
