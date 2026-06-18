/**
 * Frontend config.
 *
 * GOOGLE_CLIENT_ID is a *public* OAuth client id (safe to ship in frontend
 * code). To enable "Continue with Google":
 *   1. https://console.cloud.google.com/apis/credentials
 *   2. Create credentials -> OAuth client ID -> Web application
 *   3. Add http://localhost:5000 under "Authorized JavaScript origins"
 *   4. Paste the client id below, and put the same value in backend/.env as
 *      GOOGLE_CLIENT_ID so the server can verify the sign-in.
 * Leave it blank to hide the Google button (email/password still works).
 */
export const GOOGLE_CLIENT_ID = "";
