/**
 * Feature flags. Centralised so the redesign rollout has a single switch.
 *
 * NEXT_PUBLIC_NEW_SHELL=1 turns on the operator-loop redesign shell
 * (top bar + left rail + bottom tab bar + new routes). When off, the app
 * renders the old per-page-header chrome.
 */
export const NEW_SHELL =
  process.env.NEXT_PUBLIC_NEW_SHELL === "1" ||
  process.env.NEXT_PUBLIC_NEW_SHELL === "true";
