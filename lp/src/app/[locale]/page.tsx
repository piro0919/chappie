import {
  Clock,
  Cpu,
  Download,
  Github,
  Hand,
  Lock,
  MessageCircle,
  Mic,
  RefreshCw,
  Sparkles,
  Timer,
} from "lucide-react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

const GITHUB_URL = "https://github.com/piro0919/chappie";
const RELEASE_URL = "https://github.com/piro0919/chappie/releases/latest";

const CAPABILITY_IDS = ["chat", "timer", "time", "goodbye"] as const;
const CAPABILITY_ICONS: Record<(typeof CAPABILITY_IDS)[number], typeof Mic> = {
  chat: MessageCircle,
  timer: Timer,
  time: Clock,
  goodbye: Hand,
};
const CAPABILITY_EXAMPLE_KEYS: Record<
  (typeof CAPABILITY_IDS)[number],
  string[]
> = {
  chat: ["example1", "example2"],
  timer: ["example1", "example2", "example3"],
  time: ["example1", "example2", "example3"],
  goodbye: ["example1", "example2", "example3"],
};

const FEATURE_IDS = [
  "wake",
  "local",
  "memory",
  "menubar",
  "voices",
  "update",
] as const;
const FEATURE_ICONS: Record<(typeof FEATURE_IDS)[number], typeof Mic> = {
  wake: Mic,
  local: Lock,
  memory: MessageCircle,
  menubar: Cpu,
  voices: Sparkles,
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
            {CAPABILITY_IDS.map((id) => {
              const Icon = CAPABILITY_ICONS[id];
              return (
                <div
                  key={id}
                  className="border-(--color-cream-200) flex flex-col rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(74,56,38,0.25)]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="bg-(--color-blush-200) inline-flex rounded-2xl p-3">
                      <Icon
                        size={20}
                        strokeWidth={2}
                        className="text-(--color-cocoa-600)"
                        aria-hidden
                      />
                    </div>
                    <h3 className="text-(--color-cocoa-700) text-base font-bold">
                      {t(`capabilities.items.${id}.title`)}
                    </h3>
                  </div>
                  <ul className="mb-4 flex flex-col gap-2">
                    {CAPABILITY_EXAMPLE_KEYS[id].map((k) => (
                      <li
                        key={k}
                        className="bg-(--color-cream-100) text-(--color-cocoa-700) rounded-xl px-4 py-2 text-sm"
                      >
                        {t(`capabilities.items.${id}.${k}`)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-(--color-cocoa-500) text-sm leading-relaxed">
                    {t(`capabilities.items.${id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-(--color-cocoa-400) mx-auto mt-10 max-w-xl text-center text-xs">
            {t("capabilities.footer")}
          </p>
        </div>
      </section>

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
