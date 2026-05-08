import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { CapabilityCard } from "@/components/capability-card";
import { CAPABILITY_IDS } from "@/lib/capabilities";

export default async function CapabilitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <section className="bg-(--color-cream-100) px-6 pt-20 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10">
            <Link
              href={locale === "en" ? "/" : `/${locale}`}
              className="text-(--color-cocoa-500) hover:text-(--color-cocoa-700) inline-flex items-center gap-2 text-sm font-semibold"
            >
              <ArrowLeft size={16} strokeWidth={2.25} />
              {t("capabilities.backHome")}
            </Link>
          </div>
          <h1 className="text-(--color-cocoa-500) mb-3 text-center text-xs font-bold tracking-[0.25em]">
            {t("capabilities.allEyebrow")}
          </h1>
          <p className="text-(--color-cocoa-700) mx-auto mb-4 max-w-xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("capabilities.allHeading")}
          </p>
          <p className="text-(--color-cocoa-500) mx-auto mb-14 max-w-xl text-center text-base">
            {t("capabilities.allLead")}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {CAPABILITY_IDS.map((id) => (
              <CapabilityCard key={id} id={id} />
            ))}
          </div>
          <p className="text-(--color-cocoa-400) mx-auto mt-10 max-w-xl text-center text-xs">
            {t("capabilities.footer")}
          </p>
        </div>
      </section>
    </main>
  );
}
