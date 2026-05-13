import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UpgradeSuccess({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ja = locale === "ja";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          {ja ? "Pro へようこそ！" : "Welcome to Pro!"}
        </h1>
        <p style={{ marginBottom: "2rem", color: "rgb(82, 82, 82)" }}>
          {ja
            ? "決済が完了しました。Chappie に戻って Pro 機能をお楽しみください。"
            : "Your subscription is active. Head back to Chappie to enjoy Pro features."}
        </p>
        <a
          href="chappie://refresh"
          style={{
            display: "inline-block",
            padding: "0.875rem 1.75rem",
            background: "rgb(255, 132, 96)",
            color: "white",
            borderRadius: "9999px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {ja ? "Chappie を開く" : "Open Chappie"}
        </a>
        <div style={{ marginTop: "2rem" }}>
          <Link
            href="/"
            style={{ color: "rgb(120, 120, 120)", fontSize: "0.875rem" }}
          >
            {ja ? "ホームに戻る" : "Back to home"}
          </Link>
        </div>
      </div>
    </main>
  );
}
