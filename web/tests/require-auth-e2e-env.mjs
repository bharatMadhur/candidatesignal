const missing = ["E2E_COMPANY_EMAIL", "E2E_COMPANY_PASSWORD"].filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Authenticated E2E credentials are required. Missing: ${missing.join(", ")}`);
  process.exit(1);
}
