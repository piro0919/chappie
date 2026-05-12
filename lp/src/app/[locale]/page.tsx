import {
  ArrowRight,
  Cpu,
  Download,
  Fingerprint,
  Github,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { CapabilityCard } from "@/components/capability-card";
import { getHeroCapabilities } from "@/lib/capabilities";

const GITHUB_URL = "https://github.com/piro0919/chappie";
const RELEASE_URL = "https://github.com/piro0919/chappie/releases/latest";

// Regenerate the page once a day so the date-seeded hero capability
// rotation actually advances in production. Without this, Next captures
// `new Date()` at build time and the hero stays frozen until the next
// deploy.
export const revalidate = 86400;

const FEATURE_IDS = [
  "wake",
  "voice",
  "local",
  "memory",
  "location",
  "menubar",
  "languages",
  "update",
] as const;
const FEATURE_ICONS: Record<(typeof FEATURE_IDS)[number], typeof Mic> = {
  wake: Mic,
  voice: Fingerprint,
  local: Lock,
  memory: MessageCircle,
  location: MapPin,
  menubar: Cpu,
  languages: Globe,
  update: RefreshCw,
};

const STATE_IDS = ["idle", "listening", "talking"] as const;
const STATE_IMAGES: Record<(typeof STATE_IDS)[number], string> = {
  idle: "/hero.png",
  listening: "/listening.png",
  talking: "/talking.png",
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Hero */}
      <section className="bg-dots relative px-6 pt-20 pb-24">
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="animate-float mx-auto mb-10 w-56 sm:w-72">
            <Image
              src="/hero.png"
              alt="Chappie"
              width={512}
              height={512}
              priority
              className="drop-shadow-[0_12px_32px_rgba(106,70,40,0.22)]"
            />
          </div>

          <div className="text-(--color-cocoa-500) mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold backdrop-blur">
            <Mic size={14} strokeWidth={2.25} />
            {t("hero.badge")}
          </div>

          <h1 className="text-(--color-cocoa-700) mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="text-(--color-cocoa-600) mx-auto mb-3 max-w-2xl text-xl font-medium leading-relaxed sm:text-2xl">
            {t("hero.taglineLine1")}
            <br />
            {t("hero.taglineLine2")}
          </p>
          <p className="text-(--color-cocoa-500) mx-auto mb-10 max-w-xl text-base leading-relaxed">
            {t("hero.lead")}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={RELEASE_URL}
              className="bg-(--color-cocoa-600) hover:bg-(--color-cocoa-700) inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(74,56,38,0.45)] transition-all hover:-translate-y-0.5"
            >
              <Download size={18} strokeWidth={2.25} />
              {t("hero.downloadButton")}
            </a>
            <a
              href={GITHUB_URL}
              className="border-(--color-cream-300) text-(--color-cocoa-700) hover:bg-(--color-cream-100) inline-flex items-center gap-2 rounded-2xl border bg-white/80 px-7 py-3.5 text-base font-semibold backdrop-blur transition-all hover:-translate-y-0.5"
            >
              <Github size={18} strokeWidth={2.25} />
              {t("hero.githubButton")}
            </a>
          </div>

          <p className="text-(--color-cocoa-400) mt-6 text-xs">
            {t("hero.footnote")}
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-(--color-cream-100) px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-(--color-cocoa-500) mb-3 text-center text-xs font-bold tracking-[0.25em]">
            {t("capabilities.eyebrow")}
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-4 max-w-xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("capabilities.heading")}
          </p>
          <p className="text-(--color-cocoa-500) mx-auto mb-14 max-w-xl text-center text-base">
            {t("capabilities.lead")}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {getHeroCapabilities().map((id) => (
              <CapabilityCard key={id} id={id} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              href={
                locale === "en" ? "/capabilities" : `/${locale}/capabilities`
              }
              className="border-(--color-cream-300) text-(--color-cocoa-700) hover:bg-(--color-cream-100) inline-flex items-center gap-2 rounded-2xl border bg-white/80 px-6 py-3 text-sm font-semibold backdrop-blur transition-all hover:-translate-y-0.5"
            >
              {t("capabilities.viewAll")}
              <ArrowRight size={16} strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>

      {/* Characters (VOICEVOX) — JA locale only. The feature speaks
          Japanese; EN visitors don't benefit from it, so we hide the
          whole section to keep their pitch focused. */}
      {locale === "ja" && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-(--color-cocoa-500) mb-3 text-center text-xs font-bold tracking-[0.25em]">
              {t("characters.eyebrow")}
            </h2>
            <p className="text-(--color-cocoa-700) mx-auto mb-4 max-w-2xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t("characters.heading")}
            </p>
            <p className="text-(--color-cocoa-500) mx-auto mb-10 max-w-2xl text-center text-base leading-relaxed">
              {t("characters.lead")}
            </p>

            <div className="border-(--color-cream-200) mb-10 overflow-hidden rounded-3xl border bg-white shadow-[0_18px_40px_-20px_rgba(74,56,38,0.35)]">
              <Image
                src="/voicevox-cast.png"
                alt={t("characters.imageAlt")}
                width={1672}
                height={941}
                className="h-auto w-full"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="border-(--color-cream-200) rounded-2xl border bg-white p-6">
                <h3 className="text-(--color-cocoa-700) mb-3 text-sm font-bold tracking-[0.15em]">
                  {t("characters.lineupHeading")}
                </h3>
                <p className="text-(--color-cocoa-600) text-sm leading-relaxed">
                  {t("characters.lineupList")}
                </p>
              </div>

              <div className="border-(--color-cream-200) rounded-2xl border bg-white p-6">
                <h3 className="text-(--color-cocoa-700) mb-3 text-sm font-bold tracking-[0.15em]">
                  {t("characters.examplesHeading")}
                </h3>
                <ul className="text-(--color-cocoa-600) space-y-2 text-sm leading-relaxed">
                  <li>{t("characters.example1")}</li>
                  <li>{t("characters.example2")}</li>
                  <li>{t("characters.example3")}</li>
                </ul>
              </div>
            </div>

            <div className="border-(--color-cream-200) mt-5 rounded-2xl border bg-white p-6">
              <h3 className="text-(--color-cocoa-700) mb-3 text-sm font-bold tracking-[0.15em]">
                {t("characters.setupHeading")}
              </h3>
              <p className="text-(--color-cocoa-600) text-sm leading-relaxed">
                {t("characters.setupBody")}
              </p>
            </div>

            <p className="text-(--color-cocoa-400) mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed">
              {t("characters.credits")}
            </p>
          </div>
        </section>
      )}

      {/* Menubar showcase */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-(--color-cocoa-500) mb-4 text-xs font-bold tracking-[0.25em]">
            {t("menubar.eyebrow")}
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-10 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
            {t("menubar.headingLine1")}
            <br className="sm:hidden" />
            {t("menubar.headingLine2")}
          </p>
          <div className="border-(--color-cream-200) overflow-hidden rounded-2xl border bg-white shadow-[0_18px_40px_-20px_rgba(74,56,38,0.35)]">
            <Image
              src="/menubar.png"
              alt="Chappie in the macOS menu bar"
              width={1280}
              height={720}
              className="h-auto w-full"
              priority
            />
          </div>
          <p className="text-(--color-cocoa-500) mx-auto mt-6 max-w-md text-sm">
            {t("menubar.body")}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-(--color-cream-100) px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-(--color-cocoa-700) mb-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("features.heading")}
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto mb-14 max-w-xl text-center text-base">
            {t("features.lead")}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_IDS.map((id) => {
              const Icon = FEATURE_ICONS[id];
              return (
                <div
                  key={id}
                  className="border-(--color-cream-200) rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(74,56,38,0.25)]"
                >
                  <div className="bg-(--color-blush-200) mb-4 inline-flex rounded-2xl p-3">
                    <Icon
                      size={20}
                      strokeWidth={2}
                      className="text-(--color-cocoa-600)"
                      aria-hidden
                    />
                  </div>
                  <h3 className="text-(--color-cocoa-700) mb-2 text-base font-bold">
                    {t(`features.items.${id}.title`)}
                  </h3>
                  <p className="text-(--color-cocoa-500) text-sm leading-relaxed">
                    {t(`features.items.${id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* States gallery */}
      <section
        className="px-6 py-20"
        style={{
          backgroundImage: "url(/pattern.png)",
          backgroundSize: "320px 320px",
          backgroundRepeat: "repeat",
        }}
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-(--color-cocoa-500) mb-3 text-center text-xs font-bold tracking-[0.25em]">
            {t("states.eyebrow")}
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-12 max-w-xl text-center text-2xl font-bold tracking-tight sm:text-3xl">
            {t("states.heading")}
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {STATE_IDS.map((id) => (
              <div
                key={id}
                className="border-(--color-cream-200) flex flex-col items-center rounded-3xl border bg-white p-8 shadow-[0_6px_16px_-8px_rgba(74,56,38,0.18)]"
              >
                <Image
                  src={STATE_IMAGES[id]}
                  alt={t(`states.items.${id}.label`)}
                  width={240}
                  height={240}
                  className="mb-5 h-36 w-36 object-contain"
                />
                <div className="text-(--color-cocoa-700) mb-2 text-base font-bold">
                  {t(`states.items.${id}.label`)}
                </div>
                <p className="text-(--color-cocoa-500) text-center text-sm leading-relaxed">
                  {t(`states.items.${id}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy callout */}
      <section className="px-6 py-24">
        <div className="border-(--color-cream-200) mx-auto max-w-3xl rounded-3xl border bg-white p-10 text-center shadow-[0_8px_28px_-16px_rgba(74,56,38,0.25)] sm:p-14">
          <div className="bg-(--color-blush-200) mx-auto mb-6 inline-flex rounded-2xl p-3">
            <Lock
              size={22}
              strokeWidth={2}
              className="text-(--color-cocoa-700)"
              aria-hidden
            />
          </div>
          <h2 className="text-(--color-cocoa-700) mb-4 text-2xl font-bold sm:text-3xl">
            {t("privacy.heading")}
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto max-w-xl text-base leading-relaxed">
            {t("privacy.body")}
            <br />
            <span className="text-(--color-cocoa-400) mt-2 inline-block text-sm">
              {t("privacy.note")}
            </span>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-dots px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-(--color-cocoa-700) mb-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("finalCta.heading")}
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto mb-8 max-w-md text-base">
            {t("finalCta.lead")}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={RELEASE_URL}
              className="bg-(--color-cocoa-600) hover:bg-(--color-cocoa-700) inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(74,56,38,0.45)] transition-all hover:-translate-y-0.5"
            >
              <Download size={18} strokeWidth={2.25} />
              {t("finalCta.downloadButton")}
            </a>
            <a
              href={GITHUB_URL}
              className="border-(--color-cream-300) text-(--color-cocoa-700) hover:bg-(--color-cream-100) inline-flex items-center gap-2 rounded-2xl border bg-white/80 px-7 py-3.5 text-base font-semibold backdrop-blur transition-all hover:-translate-y-0.5"
            >
              <Github size={18} strokeWidth={2.25} />
              {t("finalCta.githubButton")}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-(--color-cream-200) text-(--color-cocoa-400) border-t px-6 py-10 text-center text-xs">
        <p>
          © {new Date().getFullYear()} {t("footer.credit")} ·{" "}
          <a
            href={GITHUB_URL}
            className="hover:text-(--color-cocoa-600) underline"
          >
            piro0919/chappie
          </a>
        </p>
      </footer>
    </main>
  );
}
