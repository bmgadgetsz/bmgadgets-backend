/**
 * Fail fast at startup when DATABASE_URL is missing or malformed.
 * MongoDB Atlas rejects connections with no database name:
 * "AtlasError: empty database name not allowed"
 */
const validateDatabaseUrl = (url: string | undefined): void => {
  if (!url?.trim()) {
    throw new Error(
      "[DATABASE_URL] is not set. Add it in Render → Environment.",
    );
  }

  if (!url.startsWith("mongodb://") && !url.startsWith("mongodb+srv://")) {
    throw new Error(
      "[DATABASE_URL] must start with mongodb:// or mongodb+srv://",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "[DATABASE_URL] is malformed. Check for unescaped special characters in the password.",
    );
  }

  const databaseName = parsed.pathname.replace(/^\//, "").split("/")[0];
  if (!databaseName) {
    throw new Error(
      "[DATABASE_URL] is missing the database name after the host. " +
        "Use: mongodb+srv://USER:PASS@HOST/bmq?appName=bmg-prod " +
        "(note the /bmq before the ?)",
    );
  }
};

export default validateDatabaseUrl;
