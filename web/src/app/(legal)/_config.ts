/**
 * Shared constants for the public legal pages (/privacy, /terms).
 *
 * These pages are intentionally outside the (app) route group so they are
 * publicly reachable without authentication — Twilio's A2P 10DLC campaign
 * reviewers must be able to load them directly. Keep the values here in one
 * place so both documents stay consistent.
 */

/** Canonical public origin. Used for canonical + Open Graph URLs. */
export const SITE_URL = "https://stack-os-six.vercel.app";

/** Product name as referenced throughout the documents (public App Store name). */
export const PRODUCT_NAME = "Bedrock Work";

/** Legal operating entity behind the product. */
export const COMPANY_LEGAL_NAME = "Stack Real Estate";

/** Public-facing contact addresses. */
export const SUPPORT_EMAIL = "support@stackwithus.com";
export const PRIVACY_EMAIL = "privacy@stackwithus.com";

/** Jurisdiction whose law governs the Terms. */
export const GOVERNING_LAW = "State of Utah, United States";

/**
 * Human-readable "Last updated" date shown on both documents. Update this
 * whenever the substantive copy changes.
 */
export const LAST_UPDATED = "June 25, 2026";
