import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UpgradeCancel({
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
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          {ja ? "決済がキャンセルされました" : "Checkout cancelled"}
        </h1>
        <p style={{ marginBottom: "2rem", color: "rgb(82, 82, 82)" }}>
          {ja
            ? "課金は発生していません。Free モードで引き続きお使いいただけます。"
            : "No charge was made. You can keep using Chappie on the free plan."}
        </p>
        <a
          href="chappie://refresh"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            border: "1px solid rgb(220, 220, 220)",
            borderRadius: "9999px",
            color: "rgb(60, 60, 60)",
            textDecoration: "none",
          }}
        >
          {ja ? "Chappie に戻る" : "Back to Chappie"}
        </a>
        <div style={{ marginTop: "1.5rem" }}>
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
