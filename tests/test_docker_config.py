from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DockerConfigTests(unittest.TestCase):
    def test_api_healthcheck_uses_deep_health_endpoint(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text()

        self.assertIn("http://localhost:8010/healthz/deep", compose)
        self.assertNotIn("http://localhost:8010/readyz", compose)

    def test_better_auth_secret_has_no_insecure_compose_default(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text()

        self.assertNotIn("change-me-in-production", compose)
        self.assertNotIn("BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET", compose)
        self.assertIn("BETTER_AUTH_SECRET_FILE: /run/secrets/better_auth_secret", compose)
        self.assertIn("better_auth_secret:", compose)

    def test_litellm_api_key_is_mounted_as_secret_not_interpolated_environment(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text()

        self.assertNotIn("RESUME_INTEL_LITELLM_API_KEY: ${RESUME_INTEL_LITELLM_API_KEY", compose)
        self.assertIn("RESUME_INTEL_LITELLM_API_KEY_FILE: /run/secrets/litellm_api_key", compose)
        self.assertIn("litellm_api_key:", compose)
        self.assertNotIn("APIFY_API_TOKEN: ${APIFY_API_TOKEN", compose)
        self.assertIn("APIFY_API_TOKEN_FILE: /run/secrets/apify_api_token", compose)
        self.assertIn("apify_api_token:", compose)
        self.assertNotIn("RESEND_API_KEY: ${RESEND_API_KEY", compose)
        self.assertIn("RESEND_API_KEY_FILE: /run/secrets/resend_api_key", compose)
        self.assertIn("resend_api_key:", compose)

    def test_gcp_compose_uses_secret_files_not_plain_env_secrets(self) -> None:
        compose = (ROOT / "docker-compose.gcp.yml").read_text()

        self.assertIn("DATABASE_URL_FILE: /run/candidatesignal-secrets/database-url", compose)
        self.assertIn("BETTER_AUTH_SECRET_FILE: /run/candidatesignal-secrets/better-auth-secret", compose)
        self.assertIn("RESUME_INTEL_LITELLM_API_KEY_FILE: /run/candidatesignal-secrets/litellm-api-key", compose)
        self.assertIn("APIFY_API_TOKEN_FILE: /run/candidatesignal-secrets/apify-api-token", compose)
        self.assertIn("RESEND_API_KEY_FILE: /run/candidatesignal-secrets/resend-api-key", compose)
        self.assertIn("OCR_REMOTE_TOKEN_FILE: /run/candidatesignal-secrets/ocr-internal-token", compose)
        self.assertNotIn("DATABASE_PASSWORD}", compose)
        self.assertNotIn("BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET", compose)
        self.assertNotIn("RESUME_INTEL_LITELLM_API_KEY: ${RESUME_INTEL_LITELLM_API_KEY", compose)
        self.assertNotIn("APIFY_API_TOKEN: ${APIFY_API_TOKEN", compose)
        self.assertNotIn("RESEND_API_KEY: ${RESEND_API_KEY", compose)
        self.assertNotIn("OCR_REMOTE_TOKEN: ${OCR_INTERNAL_TOKEN", compose)

    def test_docker_ocr_config_does_not_reuse_local_venv_command(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text()

        self.assertNotIn("OCR_COMMAND: ${OCR_COMMAND", compose)
        self.assertIn("OCR_COMMAND: ${DOCKER_OCR_COMMAND:-}", compose)

    def test_caddy_routes_self_signup_to_fastapi_not_better_auth(self) -> None:
        caddyfile = (ROOT / "deploy" / "caddy" / "Caddyfile").read_text()

        signup_index = caddyfile.index("handle /api/auth/company-signup")
        better_auth_index = caddyfile.index("handle /api/auth/*")
        self.assertLess(signup_index, better_auth_index)
        signup_block = caddyfile[signup_index:better_auth_index]
        self.assertIn("uri strip_prefix /api", signup_block)
        self.assertIn("reverse_proxy api:8010", signup_block)

    def test_staging_stack_is_protected_and_data_isolated(self) -> None:
        compose = (ROOT / "docker-compose.gcp.yml").read_text()
        caddyfile = (ROOT / "deploy" / "caddy" / "Caddyfile").read_text()

        self.assertIn("STAGING_DOMAIN", caddyfile)
        self.assertIn("basicauth", caddyfile)
        self.assertIn("X-Robots-Tag \"noindex, nofollow, noarchive\"", caddyfile)
        self.assertIn("reverse_proxy api-staging:8010", caddyfile)
        self.assertIn("reverse_proxy ui-staging:3001", caddyfile)
        self.assertIn("api-staging:", compose)
        self.assertIn("ui-staging:", compose)
        self.assertIn("worker-staging:", compose)
        self.assertIn("profiles: [\"staging\"]", compose)
        self.assertIn("secrets-staging:/run/candidatesignal-staging-secrets:ro", compose)
        self.assertIn("STAGING_RESUME_INTEL_GCS_BUCKET", compose)

    def test_production_deploy_script_refuses_random_feature_refs(self) -> None:
        deploy_script = (ROOT / "deploy" / "gcp" / "11_deploy_production.sh").read_text()

        self.assertIn("PRODUCTION_GIT_REF", deploy_script)
        self.assertIn("ALLOW_NON_PRODUCTION_REF", deploy_script)
        self.assertIn("Refusing production deploy", deploy_script)
        self.assertIn("main", deploy_script)
        self.assertIn("release-*", deploy_script)


if __name__ == "__main__":
    unittest.main()
