/** Shown when VITE_CONVEX_URL is absent, so a misconfigured build says why
 *  rather than failing blank. */
export default function Setup() {
  return (
    <main className="shell">
      <p className="eyebrow">Interval</p>
      <h1>Not connected to Convex</h1>
      <p className="lede">
        This build has no <code>VITE_CONVEX_URL</code>. Run <code>npx convex dev</code> once to
        create the deployment, then rebuild.
      </p>
    </main>
  );
}
