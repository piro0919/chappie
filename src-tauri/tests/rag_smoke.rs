// End-to-end smoke test for the long-term memory stack (Phase A-D).
//
// Runs entirely in a sandboxed $HOME so it doesn't touch the user's
// real ~/.chappie/ data. Generates fake conversation logs spanning
// ~30 days, then exercises:
//   1. session_log read/write
//   2. summarizer::recent_summaries_prompt (with manually-placed summaries)
//   3. topics::prompt_section (with manually-placed topics.json)
//   4. embedding::ensure_loaded + embed (loads the ONNX, computes vectors)
//   5. rag::init + recall_prompt (builds index, runs semantic queries)
//
// Skipped by default because step 4 requires the embedding model to be
// present in the sandbox HOME (~470 MB). Run via:
//
//   CHAPPIE_RAG_SMOKE_HOME=/tmp/chappie-rag-test \
//   cargo test --test rag_smoke -- --ignored --nocapture
//
// The harness downloads the model into that HOME on first run; future
// runs reuse it (set the env to a stable path to keep the cache).

use chappie_lib::{embedding, rag, session_log, summarizer, topics};
use chrono::{Duration, Local};
use serde_json::json;
use std::path::PathBuf;

const MODEL_URL: &str =
    "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/onnx/model.onnx";
const TOKENIZER_URL: &str =
    "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/tokenizer.json";

fn sandbox_home() -> PathBuf {
    let p = std::env::var("CHAPPIE_RAG_SMOKE_HOME")
        .unwrap_or_else(|_| "/tmp/chappie-rag-test".to_string());
    PathBuf::from(p)
}

fn setup_sandbox() -> PathBuf {
    let home = sandbox_home();
    // Wipe everything except the models dir so re-runs don't re-download.
    let log = home.join(".chappie/log");
    let sums = home.join(".chappie/summaries");
    let topics_file = home.join(".chappie/topics.json");
    let _ = std::fs::remove_dir_all(&log);
    let _ = std::fs::remove_dir_all(&sums);
    let _ = std::fs::remove_file(&topics_file);
    std::fs::create_dir_all(&log).unwrap();
    std::fs::create_dir_all(&sums).unwrap();
    std::env::set_var("HOME", &home);
    home
}

/// Write fake conversation logs spanning 30 days. Each day is themed so
/// recall queries can be matched to specific date ranges:
///   - day -30..=-25: ramen / food
///   - day -24..=-20: rust / coding
///   - day -19..=-15: family / kids
///   - day -14..=-10: hiking / weather
///   - day  -9..=-1: misc casual (within the 7-day exclusion window
///                   for L1 recall, but useful for L2 plumbing checks)
fn generate_fake_logs() {
    let today = Local::now().date_naive();
    let buckets: Vec<(i64, i64, Vec<(&str, &str)>)> = vec![
        (
            -30,
            -25,
            vec![
                (
                    "今日のお昼ラーメンにしようかな、つけ麺もいいよね",
                    "つけ麺いいですね、濃いめのつけ汁が恋しい季節です",
                ),
                (
                    "二郎系って一度食べると癖になるよね",
                    "あの背脂とニンニクは中毒性ありますよね",
                ),
                ("豚骨と醤油どっち派？", "個人的には豚骨醤油のいいとこどりが好きです"),
                (
                    "新宿でおすすめのラーメン屋ある？",
                    "新宿駅周辺だと風雲児のつけ麺が人気ですね",
                ),
                (
                    "家で作る味噌ラーメンのコツ教えて",
                    "コクのある味噌を二種類ブレンドするのがおすすめです",
                ),
                ("今日の夕飯また麺類になっちゃった", "麺好きの宿命ですね、明日は和食もアリです"),
            ],
        ),
        (
            -24,
            -20,
            vec![
                (
                    "Rust の borrow checker でずっとハマってる",
                    "ライフタイムまわりは慣れですね。具体的にはどんなエラーですか",
                ),
                ("async fn の戻り値の型って書きづらいよね", "impl Future で隠すか Box::pin でラップが定番です"),
                ("tokio と async-std どっち使ってる？", "今は tokio がデファクトです"),
                ("Cargo.toml の features の使い方がいまいち", "デフォルト無効で opt-in にするのが王道です"),
                ("Rust の Result<T, E> いいね", "?演算子と組み合わせるとエラー処理が綺麗になりますね"),
            ],
        ),
        (
            -19,
            -15,
            vec![
                ("娘の運動会がもうすぐある", "応援頑張ってください！"),
                ("息子が反抗期入ってきた気がする", "成長の証ですね、少し距離を保つのも大事です"),
                ("週末は家族でディズニー行く予定", "天気いいといいですね、楽しんできてください"),
                ("子供が熱出して保育園休んだ", "お大事に、看病大変ですよね"),
                ("子供の習い事何させてる？", "ピアノとサッカーが人気ですね"),
            ],
        ),
        (
            -14,
            -10,
            vec![
                ("週末ハイキング行きたいんだけど", "天気予報チェックしてからがいいですよ"),
                ("高尾山って初心者向き？", "ロープウェイもあるので超初心者にもおすすめです"),
                ("今日めちゃくちゃ寒くない？", "今シーズン一番の冷え込みらしいですね"),
                ("雨予報だから登山やめとくか", "無理せず延期が正解です"),
                ("紅葉の見頃ってもう過ぎた？", "標高高い場所はまだ間に合うはずです"),
            ],
        ),
        (
            -9,
            -1,
            vec![
                ("仕事の締め切りが近くて寝不足", "無理しすぎないでくださいね"),
                ("プレゼン資料まだ半分も終わってない", "アウトラインから先に固めるのがおすすめです"),
                ("ちょっと一息つきたい", "コーヒーでも淹れますか"),
                ("明日朝早いから早めに寝る", "おやすみなさい、ゆっくり休んでください"),
                ("最近運動不足だ", "散歩からでも始めてみては"),
            ],
        ),
    ];

    let mut ts_counter = 0i64;
    for (from, to, lines) in buckets {
        for day_offset in from..=to {
            let date = today + Duration::days(day_offset);
            for (user, assistant) in &lines {
                // Spread within-day timestamps slightly so they're sortable.
                ts_counter += 1;
                let line = json!({
                    "ts": date.and_hms_opt(12, 0, ts_counter as u32 % 60).unwrap()
                        .and_utc().timestamp_millis(),
                    "user": user,
                    "assistant": assistant,
                    "provider": "fake",
                    "model": "fake-model",
                });
                let path = sandbox_home()
                    .join(".chappie/log")
                    .join(format!("{}.jsonl", date.format("%Y-%m-%d")));
                use std::io::Write;
                let mut f = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&path)
                    .unwrap();
                writeln!(f, "{}", serde_json::to_string(&line).unwrap()).unwrap();
            }
        }
    }
}

fn place_fake_summaries() {
    // Write a few canned daily summaries for the past 7 days so
    // recent_summaries_prompt has something to format.
    let today = Local::now().date_naive();
    let canned: Vec<(i64, &str)> = vec![
        (-1, "仕事の締め切りが近くて寝不足気味。プレゼン資料がまだ半分しか終わっておらず焦り。夕方少し散歩した。"),
        (-3, "週末のディズニー行きの計画を立てていた。天気が気になっていた様子。"),
        (-5, "高尾山ハイキングを検討。寒さで延期判断。紅葉の話題も。"),
    ];
    for (offset, text) in canned {
        let date = today + Duration::days(offset);
        let path = sandbox_home()
            .join(".chappie/summaries")
            .join(format!("{}.json", date.format("%Y-%m-%d")));
        let body = json!({
            "date": date.format("%Y-%m-%d").to_string(),
            "text": text,
            "generated_at_unix_ms": Local::now().timestamp_millis(),
            "turns_count": 5,
        });
        std::fs::write(path, serde_json::to_string_pretty(&body).unwrap()).unwrap();
    }
}

fn place_fake_topics() {
    let topics_path = sandbox_home().join(".chappie/topics.json");
    let body = json!({
        "updated_at_unix_ms": Local::now().timestamp_millis(),
        "bullets": [
            "ラーメン全般、特につけ麺と豚骨系が好き",
            "Rust を日常的に書いている開発者",
            "子育て中、娘と息子がいる",
            "週末はハイキングなどアウトドアを好む",
            "仕事の繁忙期は寝不足になりがち",
        ]
    });
    std::fs::write(topics_path, serde_json::to_string_pretty(&body).unwrap()).unwrap();
}

fn ensure_embedding_model_files() -> Result<(), String> {
    let model_path = sandbox_home().join(".chappie/models/multilingual-e5-small.onnx");
    let tok_path = sandbox_home().join(".chappie/models/multilingual-e5-small-tokenizer.json");
    std::fs::create_dir_all(model_path.parent().unwrap()).map_err(|e| e.to_string())?;
    if !model_path.exists() || std::fs::metadata(&model_path).map(|m| m.len()).unwrap_or(0) == 0 {
        eprintln!("[smoke] downloading model from {MODEL_URL} (~470MB)…");
        let status = std::process::Command::new("curl")
            .args([
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "-o",
                model_path.to_str().unwrap(),
                MODEL_URL,
            ])
            .status()
            .map_err(|e| format!("curl spawn: {e}"))?;
        if !status.success() {
            return Err(format!("model download failed: {status}"));
        }
        let size = std::fs::metadata(&model_path).map(|m| m.len()).unwrap_or(0);
        eprintln!("[smoke] model downloaded: {} bytes", size);
    } else {
        eprintln!("[smoke] reusing cached model at {}", model_path.display());
    }
    if !tok_path.exists() {
        eprintln!("[smoke] downloading tokenizer from {TOKENIZER_URL}");
        let status = std::process::Command::new("curl")
            .args([
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "-o",
                tok_path.to_str().unwrap(),
                TOKENIZER_URL,
            ])
            .status()
            .map_err(|e| format!("curl spawn: {e}"))?;
        if !status.success() {
            return Err(format!("tokenizer download failed: {status}"));
        }
    }
    Ok(())
}

#[test]
#[ignore = "writes to a sandboxed $HOME and may download the embedding model"]
fn rag_end_to_end() {
    let home = setup_sandbox();
    eprintln!("\n=== sandbox HOME: {} ===\n", home.display());

    // ─── Phase A: raw logs ───────────────────────────────────────────
    generate_fake_logs();
    let dates = session_log::dates_with_logs();
    eprintln!("[A] dates_with_logs: {} days", dates.len());
    assert!(dates.len() >= 25, "expected ≥25 days of fake logs");

    let today = Local::now().date_naive();
    let day_minus_28 = today - Duration::days(28);
    let day_logs = session_log::load_date(day_minus_28);
    eprintln!("[A] day -28 ({}): {} turns", day_minus_28, day_logs.len());
    assert!(!day_logs.is_empty(), "day -28 should have ramen turns");
    assert!(
        day_logs.iter().any(|t| t.user.contains("ラーメン") || t.user.contains("つけ麺")),
        "day -28 user text should mention ramen"
    );

    // ─── Phase A: daily summaries ────────────────────────────────────
    place_fake_summaries();
    let summary_section = summarizer::recent_summaries_prompt(7);
    eprintln!("\n[A2] recent_summaries_prompt(7):\n{}\n", summary_section);
    assert!(summary_section.contains("ディズニー"));
    assert!(summary_section.contains("ハイキング"));

    // ─── Phase C: topics ─────────────────────────────────────────────
    place_fake_topics();
    let topics_section = topics::prompt_section();
    eprintln!("[C] topics::prompt_section:\n{}\n", topics_section);
    assert!(topics_section.contains("ラーメン"));
    assert!(topics_section.contains("Rust"));

    // ─── Phase B: embedding model + RAG index ────────────────────────
    match ensure_embedding_model_files() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("[B] SKIP embedding/RAG: {e}");
            return;
        }
    }
    match embedding::ensure_loaded() {
        Ok(_) => eprintln!("[B] embedding::ensure_loaded OK"),
        Err(e) => panic!("embedding::ensure_loaded failed: {e}"),
    }

    let probe = embedding::embed("こんにちは、これはテスト文章です", true);
    match probe {
        Some(v) => {
            eprintln!(
                "[B] embed('こんにちは…'): dim={} first_5={:?}",
                v.len(),
                &v[..5.min(v.len())]
            );
            assert_eq!(v.len(), embedding::EMBEDDING_DIM);
            let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
            assert!((norm - 1.0).abs() < 1e-3, "expected L2-normalized vector, got norm={norm}");
        }
        None => panic!("embed returned None"),
    }

    let t0 = std::time::Instant::now();
    rag::init();
    eprintln!("[B] rag::init took {:?}", t0.elapsed());

    // ─── Diagnostic: are embeddings semantically meaningful at all? ──
    // Compare a few canonical text pairs directly with cosine similarity.
    eprintln!("\n[diag] pairwise cosine similarities:");
    let pairs: &[(&str, &str)] = &[
        ("ラーメン食べたい", "つけ麺もいいよね"),
        ("ラーメン食べたい", "Rust の borrow checker"),
        ("ラーメン食べたい", "ちょっと一息つきたい"),
        ("Rust の async", "tokio と async-std どっち"),
        ("Rust の async", "娘の運動会"),
        ("子供のことで悩んでる", "娘の運動会がもうすぐ"),
        ("子供のことで悩んでる", "ラーメン食べたい"),
    ];
    for (a, b) in pairs {
        let ea = embedding::embed(a, true).unwrap();
        let eb = embedding::embed(b, false).unwrap();
        let sim = embedding::cosine_normalized(&ea, &eb);
        eprintln!("  {sim:.4}  {a:?} ⇔ {b:?}");
    }

    let queries = [
        ("ラーメン食べたい", "ラーメン"),
        ("Rust の async でハマってる", "Rust"),
        ("子供のことで悩んでる", "娘 or 息子"),
        ("ハイキングいきたい", "高尾山 or 紅葉"),
    ];
    for (q, expected_hint) in queries {
        let prompt = rag::recall_prompt(q, 3);
        eprintln!("\n[B] recall_prompt({q:?}) → expected hint: {expected_hint}\n{}\n", prompt);
        assert!(!prompt.is_empty(), "recall returned empty for query: {q}");
    }

    eprintln!("\n=== smoke test PASS ===\n");
}
