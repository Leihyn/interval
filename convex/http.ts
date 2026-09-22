import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpAction } from "./_generated/server";
import { api, components } from "./_generated/api";

/**
 * AgentMail inbound adapter.
 *
 * This is deliberately thin. It unwraps the webhook payload and hands the raw
 * body to the same ingestReply mutation the board's paste box calls, so the
 * triage path in the demo is the triage path in production.
 */
const http = httpRouter();

http.route({
  path: "/agentmail/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    const from: string | undefined = body.from ?? body.sender ?? body.envelope?.from;
    const text: string | undefined = body.text ?? body.plain ?? body.body;

    if (!from || !text) {
      return new Response("Missing sender or body", { status: 400 });
    }

    const result = await ctx.runMutation(api.replies.ingestReply, {
      email: String(from).toLowerCase().trim(),
      rawText: String(text),
      channel: "email",
    });

    // The outbound auto-reply is sent by the caller only when an AgentMail key
    // is configured. The level and the fixed string are returned either way.
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Serves the built frontend at the deployment's convex.site root. Registered
// after the webhook route so the API path keeps priority.
registerStaticRoutes(http, components.staticHosting);

export default http;
