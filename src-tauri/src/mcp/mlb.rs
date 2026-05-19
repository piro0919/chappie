// MLB game scores via statsapi.mlb.com (free, no key, official).
// Covers "今日の大谷の試合" / "ドジャースの試合結果" / generic MLB
// scoreboard. NPB / soccer have no equivalent free official API; for
// those the news + fetch_readable drill-in pattern still applies.

use chrono::Utc;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_mlb_games",
            "description": "MLB の試合スコア・予定を取得（「大谷の今日の試合」「ドジャースの試合結果」「MLB の試合教えて」など）。team=任意（英語の正式名の一部、例: 'Dodgers', 'Yankees'）。日本人選手→チーム: 大谷=Dodgers / ダルビッシュ=Padres / 鈴木誠也=Cubs / 千賀=Mets / 吉田正尚=Red Sox / 山本由伸=Dodgers / 今永=Cubs。date=任意（YYYY-MM-DD UTC、未指定で直近 2 日分が返るので日本時間の『今日』『昨日』両方カバー）。返り値は status (Scheduled/In Progress/Final)、home/away (チーム名+score)、venue、current_inning。読み上げ: Final は勝敗、In Progress は現在のスコアと回、Scheduled は開始時刻。",
            "parameters": {
                "type": "object",
                "properties": {
                    "team": {
                        "type": "string",
                        "description": "チーム名フィルタ（部分一致・英語）。例: 'Dodgers', 'Yankees'。"
                    },
                    "date": {
                        "type": "string",
                        "description": "YYYY-MM-DD 形式の日付（UTC）。未指定なら今日と昨日(UTC) の 2 日分。"
                    }
                },
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "games" => games(args).await,
        other => json!({ "error": format!("unknown mlb tool: {}", other) }).to_string(),
    }
}

async fn games(args: &Value) -> String {
    let team_filter = args
        .get("team")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());

    let (start_date, end_date) = match args.get("date").and_then(|v| v.as_str()) {
        Some(d) if !d.trim().is_empty() => (d.to_string(), d.to_string()),
        _ => {
            let today = Utc::now().date_naive();
            let yesterday = today - chrono::Duration::days(1);
            (
                yesterday.format("%Y-%m-%d").to_string(),
                today.format("%Y-%m-%d").to_string(),
            )
        }
    };

    let url = format!(
        "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate={start_date}&endDate={end_date}&hydrate=team,linescore"
    );

    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("fetch failed: {}", e) }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => return json!({ "error": format!("json parse failed: {}", e) }).to_string(),
    };

    let mut games_out: Vec<Value> = Vec::new();
    if let Some(dates) = body.get("dates").and_then(|v| v.as_array()) {
        for date_entry in dates {
            let game_date = date_entry
                .get("date")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let Some(games_arr) = date_entry.get("games").and_then(|v| v.as_array()) else {
                continue;
            };
            for g in games_arr {
                let home_name = g
                    .pointer("/teams/home/team/name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let away_name = g
                    .pointer("/teams/away/team/name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                if let Some(filter) = &team_filter {
                    if !home_name.to_lowercase().contains(filter)
                        && !away_name.to_lowercase().contains(filter)
                    {
                        continue;
                    }
                }

                let status = g
                    .pointer("/status/detailedState")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let home_score = g.pointer("/teams/home/score").and_then(|v| v.as_i64());
                let away_score = g.pointer("/teams/away/score").and_then(|v| v.as_i64());
                let venue = g
                    .pointer("/venue/name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let game_time_utc = g
                    .get("gameDate")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let inning = g.pointer("/linescore/currentInning").and_then(|v| v.as_i64());
                let inning_half = g
                    .pointer("/linescore/inningHalf")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                games_out.push(json!({
                    "date": game_date,
                    "status": status,
                    "home": { "team": home_name, "score": home_score },
                    "away": { "team": away_name, "score": away_score },
                    "venue": venue,
                    "game_time_utc": game_time_utc,
                    "current_inning": inning,
                    "inning_half": inning_half,
                }));
            }
        }
    }

    let fallback_url = if let Some(filter) = &team_filter {
        format!(
            "https://www.mlb.com/scores?team={}",
            urlencoding::encode(filter)
        )
    } else {
        "https://www.mlb.com/scores".to_string()
    };

    json!({
        "team_filter": args.get("team").cloned().unwrap_or(Value::Null),
        "start_date": start_date,
        "end_date": end_date,
        "count": games_out.len(),
        "games": games_out,
        "fallback_url": fallback_url,
        "source": "statsapi.mlb.com",
    })
    .to_string()
}
