declare namespace Cloudflare {
  interface Env {
    PROSPECTO_OWNER_EMAIL?: string;
    PROSPECTO_PILOT_BATCH?: string;
    GOOGLE_PLACES_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
