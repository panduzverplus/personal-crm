// Shared by src/lib/auth.ts and src/proxy.ts, so it must stay free of imports.

const SECONDS_IN_DAY = 24 * 60 * 60;

/** A login lasts this many days from the last visit on the device. */
export const SESSION_DAYS = 30;
export const SESSION_EXPIRES_IN = SESSION_DAYS * SECONDS_IN_DAY;

/** A visit moves the end of the session at most once a day. */
export const SESSION_UPDATE_AGE = SECONDS_IN_DAY;
