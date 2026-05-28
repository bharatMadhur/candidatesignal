import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const body = await response.text();
  return { response, body };
}

async function main() {
  const home = await get("/");
  assert.equal(home.response.status, 200, "homepage should load");
  assert.match(home.body, /candidateSignal\.ai/, "homepage should show product brand");
  assert.match(home.body, /Recruiter Login|Recruiter workspace/i, "homepage should include recruiter login");
  assert.match(home.body, /Candidate Access|Candidate portal/i, "homepage should include candidate access");
  assert.doesNotMatch(home.body, /Admin Login/i, "homepage should not expose admin login");
  assert.match(home.body, /Upload resumes/i, "homepage should preserve public-home content");

  const companyMode = await get("/?login=company");
  assert.equal(companyMode.response.status, 200, "recruiter login mode should load from homepage");
  assert.match(companyMode.body, /Recruiter Login|Recruiter workspace/i, "recruiter login mode should be visible");

  const ignoredAdminQuery = await get("/?login=admin");
  assert.equal(ignoredAdminQuery.response.status, 200, "legacy admin query should not break homepage");
  assert.doesNotMatch(ignoredAdminQuery.body, /Enter Admin System/i, "legacy admin query should not open admin login");

  const adminMode = await get("/admin");
  assert.equal(adminMode.response.status, 200, "admin login mode should load from /admin");
  assert.match(adminMode.body, /Admin Login|Admin System/i, "admin login mode should be visible on /admin");

  const removedLogin = await get("/login");
  assert.equal(removedLogin.response.status, 404, "/login should not exist as a standalone page");

  const removedAdminLogin = await get("/admin/login");
  assert.equal(removedAdminLogin.response.status, 404, "/admin/login should not exist as a standalone page");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
