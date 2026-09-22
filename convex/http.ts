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

    // A webhook event nests the message; a direct post does not. Read both,
    // because guessing one shape is how an integration dies silently.
    const msg = body.message ?? body.data ?? body;
    const from: string | undefined = msg.from ?? msg.sender ?? msg.envelope?.from;
    const text: string | undefined =
      msg.text ?? msg.extracted_text ?? msg.plain ?? msg.body;

    if (!from || !text) {
      return new Response("Missing sender or body", { status: 400 });
    }

    const result = await ctx.runAction(api.replies.submitReply, {
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
