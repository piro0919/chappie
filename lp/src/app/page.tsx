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
import type { ReactNode } from "react";

const GITHUB_URL = "https://github.com/piro0919/chappie";
const RELEASE_URL = "https://github.com/piro0919/chappie/releases/latest";

const CAPABILITIES: {
  icon: typeof Mic;
  title: string;
  examples: string[];
  body: string;
}[] = [
  {
    icon: MessageCircle,
    title: "おしゃべりする",
    examples: [
      "「今日のお昼、何食べるのおすすめ？」",
      "「明日の予定、整理を手伝って」",
    ],
    body: "雑談から相談ごとまで。直前のやり取りを覚えているので、「さっきの続きなんだけど」もそのまま伝わります。",
  },
  {
    icon: Timer,
    title: "タイマーをセットする",
    examples: [
      "「3分タイマーかけて」",
      "「お茶のタイマー5分」",
      "「全部キャンセル」",
    ],
    body: "「○分タイマー」と言うだけで設定。鳴ったら声で教えてくれます。複数同時セット・残り時間確認・キャンセルもどうぞ。",
  },
  {
    icon: Clock,
    title: "時刻や日付を答える",
    examples: [
      "「今何時？」",
      "「今日は何曜日？」",
      "「今日って何月何日だっけ？」",
    ],
    body: "Mac の時計を見て答えます。「あと何時間で◯時？」みたいな計算もそのままお任せ。",
  },
  {
    icon: Hand,
    title: "「またね」で静かに戻る",
    examples: ["「ありがとう、またね」", "「じゃあね」", "「さようなら」"],
    body: "会話の終わりは Chappie 自身が察知。次の「チャッピー」を呼ぶまで、そっと待機モードに戻ります。ボタンを押す必要はありません。",
  },
];

const FEATURES: { icon: typeof Mic; title: string; body: string }[] = [
  {
    icon: Mic,
    title: "「チャッピー」と呼ぶだけ",
    body: "ホットキーもクリックも不要。日常の声でそのまま起動して、続けて話しかけられます。",
  },
  {
    icon: Lock,
    title: "音声はローカルで処理",
    body: "声の文字起こしは Mac の中で完結。マイクで拾った音そのものが、インターネットに送られることはありません。",
  },
  {
    icon: MessageCircle,
    title: "会話の流れを記憶",
    body: "直近 20 ターンを覚えていて、「さっきの話の続き」もそのまま自然につながります。",
  },
  {
    icon: Cpu,
    title: "メニューバー常駐 / Dock を汚さない",
    body: "本体はメニューバーのアイコンだけ。設定ウィンドウは必要なときだけ開きます。",
  },
  {
    icon: Sparkles,
    title: "macOS 標準の声で読み上げ",
    body: "macOS に入っている読み上げ音声から、好きな声を選べます。日本語・英語、男性・女性の切り替えも自由です。",
  },
  {
    icon: RefreshCw,
    title: "自動アップデート",
    body: "新しいバージョンが出たら起動時に通知 → ワンクリックで更新。手動DLは不要です。",
  },
];

export default function Page(): ReactNode {
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
            macOS 向けハンズフリー音声 AI
          </div>

          <h1 className="text-(--color-cocoa-700) mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Chappie
          </h1>
          <p className="text-(--color-cocoa-600) mx-auto mb-3 max-w-2xl text-xl font-medium leading-relaxed sm:text-2xl">
            「チャッピー」と呼びかけるだけ。
            <br />
            あとは声だけで完結する。
          </p>
          <p className="text-(--color-cocoa-500) mx-auto mb-10 max-w-xl text-base leading-relaxed">
            メニューバーに常駐する、ハンズフリー音声 AI
            アシスタント。キーボードもマウスもいらない、声で話しかけるだけの新しい使い方。
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={RELEASE_URL}
              className="bg-(--color-cocoa-600) hover:bg-(--color-cocoa-700) inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(74,56,38,0.45)] transition-all hover:-translate-y-0.5"
            >
              <Download size={18} strokeWidth={2.25} />
              ダウンロード（macOS）
            </a>
            <a
              href={GITHUB_URL}
              className="border-(--color-cream-300) text-(--color-cocoa-700) hover:bg-(--color-cream-100) inline-flex items-center gap-2 rounded-2xl border bg-white/80 px-7 py-3.5 text-base font-semibold backdrop-blur transition-all hover:-translate-y-0.5"
            >
              <Github size={18} strokeWidth={2.25} />
              GitHub
            </a>
          </div>

          <p className="text-(--color-cocoa-400) mt-6 text-xs">
            M1 以降の Mac で動きます / オープンソース / 個人開発
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-(--color-cream-100) px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-(--color-cocoa-500) mb-3 text-center text-xs font-bold tracking-[0.25em]">
            CHAPPIE でできること
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-4 max-w-xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
            こんな声がけ、できます。
          </p>
          <p className="text-(--color-cocoa-500) mx-auto mb-14 max-w-xl text-center text-base">
            まずは「チャッピー」と呼びかけて、続けて話しかけるだけ。
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, examples, body }) => (
              <div
                key={title}
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
                    {title}
                  </h3>
                </div>
                <ul className="mb-4 flex flex-col gap-2">
                  {examples.map((ex) => (
                    <li
                      key={ex}
                      className="bg-(--color-cream-100) text-(--color-cocoa-700) rounded-xl px-4 py-2 text-sm"
                    >
                      {ex}
                    </li>
                  ))}
                </ul>
                <p className="text-(--color-cocoa-500) text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <p className="text-(--color-cocoa-400) mx-auto mt-10 max-w-xl text-center text-xs">
            できることはこれから少しずつ増えていきます。
          </p>
        </div>
      </section>

      {/* Menubar showcase */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-(--color-cocoa-500) mb-4 text-xs font-bold tracking-[0.25em]">
            メニューバーに常駐
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-10 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
            ずっとメニューバーの隅っこに。
            <br className="sm:hidden" />
            必要なときだけ顔を出します。
          </p>
          <div className="border-(--color-cream-200) overflow-hidden rounded-2xl border bg-white shadow-[0_18px_40px_-20px_rgba(74,56,38,0.35)]">
            <Image
              src="/menubar.png"
              alt="macOS のメニューバーに常駐する Chappie アイコン"
              width={1280}
              height={720}
              className="h-auto w-full"
              priority
            />
          </div>
          <p className="text-(--color-cocoa-500) mx-auto mt-6 max-w-md text-sm">
            Dock には出ない、ウィンドウもない。声で起こすまで静かに待機します。
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-(--color-cream-100) px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-(--color-cocoa-700) mb-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            日常に溶けるアシスタント
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto mb-14 max-w-xl text-center text-base">
            必要なときだけ顔を出す、ちょうどいい距離感。
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
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
                  {title}
                </h3>
                <p className="text-(--color-cocoa-500) text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
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
            3 つの表情
          </h2>
          <p className="text-(--color-cocoa-700) mx-auto mb-12 max-w-xl text-center text-2xl font-bold tracking-tight sm:text-3xl">
            状態はメニューバーの表情で分かる。
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                src: "/hero.png",
                label: "待機中",
                body: "「チャッピー」と呼ばれるのを静かに待っています。",
              },
              {
                src: "/listening.png",
                label: "聞いています",
                body: "あなたの声に耳を澄ませているところ。",
              },
              {
                src: "/talking.png",
                label: "喋っています",
                body: "返事を声に出して読み上げています。",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="border-(--color-cream-200) flex flex-col items-center rounded-3xl border bg-white p-8 shadow-[0_6px_16px_-8px_rgba(74,56,38,0.18)]"
              >
                <Image
                  src={s.src}
                  alt={s.label}
                  width={240}
                  height={240}
                  className="mb-5 h-36 w-36 object-contain"
                />
                <div className="text-(--color-cocoa-700) mb-2 text-base font-bold">
                  {s.label}
                </div>
                <p className="text-(--color-cocoa-500) text-center text-sm leading-relaxed">
                  {s.body}
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
            音声はあなたの Mac の中だけ
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto max-w-xl text-base leading-relaxed">
            マイクで拾った音は、Mac
            の中で文字に変換します。録音そのものがインターネットに出ることはありません。返事を考えてもらうために、文字に変えた質問だけを{" "}
            <b>ChatGPT</b> に送ります。
            <br />
            <span className="text-(--color-cocoa-400) mt-2 inline-block text-sm">
              ※ ご利用には OpenAI のアカウントとお手元の API キーが必要です。
            </span>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-dots px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-(--color-cocoa-700) mb-5 text-3xl font-bold tracking-tight sm:text-4xl">
            さっそく話しかけてみよう。
          </h2>
          <p className="text-(--color-cocoa-500) mx-auto mb-8 max-w-md text-base">
            ダウンロードして、メニューバーの Chappie
            アイコンに向かって「チャッピー」と一言。
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={RELEASE_URL}
              className="bg-(--color-cocoa-600) hover:bg-(--color-cocoa-700) inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(74,56,38,0.45)] transition-all hover:-translate-y-0.5"
            >
              <Download size={18} strokeWidth={2.25} />
              ダウンロード
            </a>
            <a
              href={GITHUB_URL}
              className="border-(--color-cream-300) text-(--color-cocoa-700) hover:bg-(--color-cream-100) inline-flex items-center gap-2 rounded-2xl border bg-white/80 px-7 py-3.5 text-base font-semibold backdrop-blur transition-all hover:-translate-y-0.5"
            >
              <Github size={18} strokeWidth={2.25} />
              ソースコード
            </a>
          </div>
        </div>
      </section>

      <footer className="border-(--color-cream-200) text-(--color-cocoa-400) border-t px-6 py-10 text-center text-xs">
        <p>
          © {new Date().getFullYear()} Chappie ·{" "}
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
