// Keyword-based tool rescue for the personalized (hot-set) routing path.
//
// Background: `tools::personalized_tools` trims the per-user cold tools
// (the MCP info long-tail + a few native novelties) out of the payload
// and relies on the `need_more_tools` escape tool to recover when a
// trimmed tool is actually needed. That escape fires unreliably on
// weaker models — Gemini Flash (the locked-in Free-mode model) never
// called it in golden testing, so a trimmed tool like `mcp_quake_recent`
// becomes unreachable: the model just answers from (stale) knowledge.
//
// Rescue closes that gap WITHOUT leaning on the escape tool. When the
// utterance contains a high-precision domain keyword for a trimmed tool
// (地震 → mcp_quake_recent, オーロラ → mcp_aurora_forecast, 株価 →
// mcp_stocks_quote, …), we splice just that tool back into the hot set
// for this one turn. Gemini then sees the right tool directly — no extra
// LLM round-trip (the most painful cost in a voice app).
//
// Conservative by construction, mirroring `llm::chitchat`'s asymmetry:
//   - false positive (rescue a tool that wasn't needed): a few hundred
//     wasted tokens that turn, no UX breakage — the model just ignores
//     the extra tool.
//   - false negative (miss a rescue): degrades to today's behavior
//     (escape best-effort / knowledge answer).
// So we only map keywords that are *distinctive* to one domain. Generic
// words that ride along with unrelated requests (「とは」「換算」「波」)
// are deliberately excluded — they'd rescue on chitchat and pollute the
// payload.
//
// Cache note: splicing a tool in fragments the prompt-cache prefix for
// that turn. Accepted for the same reason chitchat fragmentation is — a
// turn that needs `mcp_quake_recent` was a distinct request that would
// have missed the steady-state hot-set prefix anyway, and consecutive
// non-rescue turns keep sharing the stable prefix.
//
// JP + EN dictionaries are comprehensive. The other 7 languages start
// from the `universal` tokens only (script-neutral proper nouns /
// acronyms like "pokemon", "iss", "mlb", "aurora") and can grow from
// telemetry — same staged rollout as chitchat.

use crate::i18n::Lang;
use std::collections::HashSet;

/// One trimmed tool plus the keywords that should pull it back into the
/// per-turn payload. `ja` is matched as raw CJK substrings; `en` and
/// `universal` are matched against the lowercased utterance (so they
/// also fire inside Japanese text, e.g. "ISS" / "MLB" / "Pokémon").
struct RescueEntry {
    tool: &'static str,
    ja: &'static [&'static str],
    en: &'static [&'static str],
    universal: &'static [&'static str],
}

/// High-precision keyword → trimmed-tool map. Only tools that are
/// actually trimmable (every `mcp_*`, plus the `TRIMMABLE_NATIVE_TOOLS`
/// in `tools.rs`) are worth listing here; rescuing an always-keep tool
/// would be a no-op. Generic catch-all-able tools (wiki_summary,
/// units_convert) are intentionally omitted — their keywords are too
/// broad to rescue safely.
const RESCUE_MAP: &[RescueEntry] = &[
    RescueEntry {
        tool: "mcp_quake_recent",
        ja: &["地震", "じしん", "揺れ", "余震"],
        en: &["earthquake", "quake"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_aurora_forecast",
        ja: &["オーロラ"],
        en: &[],
        universal: &["aurora"],
    },
    RescueEntry {
        tool: "mcp_astro_sunmoon",
        ja: &[
            "日の出",
            "日の入り",
            "日没",
            "月齢",
            "満月",
            "新月",
            "月の出",
        ],
        en: &["sunrise", "sunset", "moonrise", "moon phase"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_fx_rate",
        ja: &["為替", "ドル円", "円相場", "ユーロ円"],
        en: &["exchange rate", "forex"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_stocks_quote",
        ja: &["株価", "銘柄", "日経平均", "日経"],
        en: &["stock price", "stock quote", "nasdaq", "dow jones"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_iss_location",
        ja: &["宇宙ステーション", "国際宇宙"],
        en: &["space station"],
        universal: &["iss"],
    },
    RescueEntry {
        tool: "mcp_flights_overhead",
        ja: &["上空", "頭上の飛行機", "飛んでる飛行機"],
        en: &["flights overhead", "plane overhead", "planes above"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_mlb_games",
        ja: &["大谷", "メジャーリーグ", "大リーグ"],
        en: &["major league"],
        universal: &["mlb"],
    },
    RescueEntry {
        tool: "mcp_pokemon_stats",
        ja: &["ポケモン"],
        en: &[],
        universal: &["pokemon", "pokémon"],
    },
    RescueEntry {
        tool: "mcp_anime_info",
        ja: &["アニメ"],
        en: &[],
        universal: &["anime"],
    },
    RescueEntry {
        tool: "mcp_airquality_current",
        ja: &["大気汚染", "空気の汚れ", "空気の質"],
        en: &["air quality"],
        universal: &["pm2.5"],
    },
    RescueEntry {
        tool: "mcp_marine_current",
        ja: &["波の高さ", "波高", "潮位", "サーフ"],
        en: &["wave height", "surf forecast"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_holidays_next",
        ja: &["祝日", "祭日", "次の休み", "次の連休"],
        en: &["next holiday", "public holiday"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_news_latest",
        ja: &["ニュース", "速報", "最新ニュース"],
        en: &["latest news", "headlines"],
        universal: &[],
    },
    RescueEntry {
        tool: "mcp_wiki_onthisday",
        ja: &["今日は何の日", "何の日"],
        en: &["on this day"],
        universal: &[],
    },
    RescueEntry {
        tool: "set_wallpaper",
        ja: &["壁紙", "背景画像", "デスクトップの画像"],
        en: &["wallpaper", "desktop background"],
        universal: &[],
    },
    RescueEntry {
        tool: "list_capabilities",
        ja: &["何ができ", "できること", "できる事", "使い方"],
        en: &["what can you do", "your capabilities", "what do you do"],
        universal: &[],
    },
];

/// Returns the set of tool names whose domain keywords appear in the
/// utterance. Caller (dispatch) unions these into the hot set so
/// `personalized_tools` includes them this turn. Returns an empty set on
/// the common no-match path (zero allocation cost beyond the empty set).
pub fn rescue_tool_names(utterance: &str, lang: Lang) -> HashSet<String> {
    let mut out = HashSet::new();
    let trimmed = utterance.trim();
    if trimmed.is_empty() {
        return out;
    }
    let lower = trimmed.to_lowercase();

    for entry in RESCUE_MAP {
        // Universal tokens (acronyms / proper nouns) are checked for
        // every language against the lowercased text.
        let hit_universal = entry.universal.iter().any(|k| lower.contains(k));
        // JP keywords fire for Japanese (raw CJK substring). EN keywords
        // fire for English and, as a pragmatic baseline, every other
        // non-CJK language until their own dictionaries are filled in.
        let hit_lang = match lang {
            Lang::Ja => entry.ja.iter().any(|k| trimmed.contains(k)),
            Lang::Zh | Lang::Ko => false,
            _ => entry.en.iter().any(|k| lower.contains(k)),
        };
        if hit_universal || hit_lang {
            out.insert(entry.tool.to_string());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ja_distinctive_keywords_rescue_their_tool() {
        let cases = [
            ("地震あった？", "mcp_quake_recent"),
            ("今夜オーロラ見える？", "mcp_aurora_forecast"),
            ("明日の日の出は何時？", "mcp_astro_sunmoon"),
            ("ドル円いくら？", "mcp_fx_rate"),
            ("トヨタの株価は？", "mcp_stocks_quote"),
            (
                "ポケモンのピカチュウのステータス教えて",
                "mcp_pokemon_stats",
            ),
            ("大谷の試合どうだった？", "mcp_mlb_games"),
            ("壁紙を森に変えて", "set_wallpaper"),
            ("次の祝日いつ？", "mcp_holidays_next"),
            ("最新ニュース教えて", "mcp_news_latest"),
            ("何ができるの？", "list_capabilities"),
        ];
        for (utt, want) in cases {
            let got = rescue_tool_names(utt, Lang::Ja);
            assert!(
                got.contains(want),
                "{utt:?} should rescue {want}, got {got:?}"
            );
        }
    }

    #[test]
    fn en_and_universal_keywords_rescue() {
        assert!(rescue_tool_names("is there an earthquake nearby", Lang::En)
            .contains("mcp_quake_recent"));
        assert!(
            rescue_tool_names("show me the latest pokemon stats", Lang::En)
                .contains("mcp_pokemon_stats")
        );
        // Universal acronym fires even inside Japanese text.
        assert!(rescue_tool_names("ISSは今どこ？", Lang::Ja).contains("mcp_iss_location"));
        assert!(rescue_tool_names("MLBの結果は？", Lang::Ja).contains("mcp_mlb_games"));
    }

    #[test]
    fn plain_chitchat_rescues_nothing() {
        for utt in ["ありがとう", "おはよう", "元気？", "今日はいい天気だね"] {
            assert!(
                rescue_tool_names(utt, Lang::Ja).is_empty(),
                "{utt:?} should not rescue anything"
            );
        }
        assert!(rescue_tool_names("thanks a lot", Lang::En).is_empty());
        assert!(rescue_tool_names("", Lang::Ja).is_empty());
    }

    #[test]
    fn generic_words_do_not_overtrigger() {
        // "波" alone is too generic and is NOT a keyword (we require
        // 波の高さ / 波高 / 潮位 / サーフ), so casual mentions don't rescue.
        assert!(rescue_tool_names("人生は波があるね", Lang::Ja).is_empty());
        // A weather question must not pull the marine tool.
        assert!(!rescue_tool_names("明日の天気は？", Lang::Ja).contains("mcp_marine_current"));
    }
}
