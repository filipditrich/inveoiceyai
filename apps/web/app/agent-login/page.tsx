import { agentLoginAction } from "@/actions/agent-login";
import { Button } from "@/components/ui/button";
import { env } from "@invoicey/env/server";

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const enabled = Boolean(env.INVOICEY_AGENT_LOGIN_SECRET);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
          Agent access
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invoicey agent login
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Issues a session for the workspace agent user. This is not product
          password auth — it only exists so automated browsers can open the app.
        </p>
      </div>
      {!enabled ? (
        <p className="text-destructive text-sm">
          Set INVOICEY_AGENT_LOGIN_SECRET (min 16 characters) to enable this
          page.
        </p>
      ) : (
        <form action={agentLoginAction} className="space-y-3">
          <label className="grid gap-1 text-sm">
            <span>Shared secret</span>
            <input
              name="secret"
              type="password"
              required
              className="border-input rounded-md border px-3 py-2"
            />
          </label>
          {invalid ? (
            <p className="text-destructive text-sm" role="alert">
              {invalid}
            </p>
          ) : null}
          <Button type="submit">Issue session</Button>
        </form>
      )}
    </main>
  );
}
