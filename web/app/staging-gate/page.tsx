import { BrandMark } from "../components/brand";

type StagingGatePageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

export default async function StagingGatePage({ searchParams }: StagingGatePageProps) {
  const params = await searchParams;
  const next = safeNextPath(params?.next);
  const hasError = params?.error === "1";

  return (
    <main className="stagingGateShell">
      <section className="stagingGatePanel" aria-label="Staging access gate">
        <BrandMark className="stagingGateBrand" />
        <div>
          <p className="eyebrow">Private staging workspace</p>
          <h1>Enter the staging password</h1>
          <p>
            This gate is separate from recruiter login. You should only enter it
            once per browser session, then use your normal workspace account.
          </p>
        </div>
        <form action="/api/staging-gate" method="post" className="stagingGateForm">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>Staging password</span>
            <input name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
          {hasError ? <p className="formError">Incorrect staging password.</p> : null}
          <button type="submit" className="primary">Continue to staging</button>
        </form>
      </section>
    </main>
  );
}

function safeNextPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
