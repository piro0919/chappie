// Single source of truth for "what can Chappie do?". Exposed via a tool so
// the system prompt stays slim — the LLM only pulls this list when the user
// actually asks. Keep entries punchy, one or two examples each, in the
// user's voice (not API parlance). When you add a new tool, also add a
// matching entry here so users can discover it just by asking.

use crate::i18n::Lang;

pub fn capabilities_text() -> String {
    match crate::i18n::current() {
        Lang::Ja => capabilities_ja(),
        Lang::En => capabilities_en(),
    }
}

fn capabilities_ja() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "おしゃべり",
            &["雑談、相談、質問への回答（直前の話題は覚えてる）"],
        ),
        (
            "時間",
            &[
                "今何時？／今日の日付",
                "3分タイマー、5分タイマー（複数同時 OK）",
                "明日7時に起こして、20時に薬って言って（リマインダーは再起動後も保持）",
            ],
        ),
        ("天気", &["現在地の天気、明日の傘いる？、東京の天気"]),
        (
            "ウェブ",
            &[
                "YouTube 開いて、Apple のサイト開いて",
                "○○ググって（既定ブラウザで Google 検索）",
            ],
        ),
        (
            "アプリ・フォルダ",
            &[
                "Slack 開いて、Spotify 起動して、メモ開いて",
                "ダウンロードフォルダ開いて、アプリケーションフォルダ開いて、ゴミ箱開いて",
            ],
        ),
        ("音量", &["音量30にして、もう少し下げて、ミュート"]),
        (
            "音楽",
            &[
                "次の曲、止めて（起動中の Spotify / Apple Music を操作）",
                "いま何の曲？（曲名・アーティスト読み上げ）",
            ],
        ),
        (
            "クリップボード",
            &["クリップボード読んで", "○○書いてコピーしといて"],
        ),
        (
            "スクリーンショット",
            &[
                "スクショ撮って（範囲選択 → クリップボード）",
                "全画面キャプチャして、デスクトップに保存して",
            ],
        ),
        (
            "メモ",
            &[
                "これメモして: ○○",
                "○○のメモ探して、最近のメモ読んで",
            ],
        ),
        (
            "Mac の状態",
            &["バッテリー何％？、充電あとどれくらい？"],
        ),
        (
            "ロック・スリープ",
            &[
                "画面ロック、ディスプレイ消して、スリープして",
                "スリープしないでおいて、30分起きてて、解除して",
            ],
        ),
        ("終了", &["「またね」「ありがとう」で待機モードに戻る"]),
    ];
    render(categories)
}

fn capabilities_en() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "Chat",
            &["Casual chat, advice, Q&A (remembers the recent thread)"],
        ),
        (
            "Time",
            &[
                "What time is it? / What's today's date?",
                "Set a 3-minute timer, set a 5-minute timer (multiple at once is fine)",
                "Wake me at 7 tomorrow, remind me to take meds at 8 PM (reminders survive restart)",
            ],
        ),
        (
            "Weather",
            &["Weather here, do I need an umbrella tomorrow?, weather in Tokyo"],
        ),
        (
            "Web",
            &[
                "Open YouTube, open Apple's site",
                "Google ___ (searches in your default browser)",
            ],
        ),
        (
            "Apps & folders",
            &[
                "Open Slack, launch Spotify, open Notes",
                "Open Downloads, open Applications, open Trash",
            ],
        ),
        (
            "Volume",
            &["Set volume to 30, turn it down a bit, mute"],
        ),
        (
            "Music",
            &[
                "Next track, pause (controls a running Spotify or Apple Music)",
                "What's playing? (reads the track + artist)",
            ],
        ),
        (
            "Clipboard",
            &["Read the clipboard", "Write ___ and copy it for me"],
        ),
        (
            "Screenshots",
            &[
                "Take a screenshot (selection → clipboard)",
                "Capture the whole screen and save it to the desktop",
            ],
        ),
        (
            "Notes",
            &[
                "Make a note: ___",
                "Find notes about ___, read my recent notes",
            ],
        ),
        (
            "Mac status",
            &["What's the battery at? How long until it's charged?"],
        ),
        (
            "Lock & sleep",
            &[
                "Lock the screen, turn the display off, sleep",
                "Don't let it sleep, stay awake for 30 minutes, release that",
            ],
        ),
        (
            "End",
            &["Say 'see you' or 'thanks' to go back to standby"],
        ),
    ];
    render(categories)
}

fn render(categories: &[(&str, &[&str])]) -> String {
    let mut out = String::new();
    for (category, examples) in categories {
        out.push_str(&format!("【{category}】\n"));
        for ex in *examples {
            out.push_str(&format!("- {ex}\n"));
        }
    }
    out
}
