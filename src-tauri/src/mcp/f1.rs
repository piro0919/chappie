// Formula 1 schedule / results / standings via the Jolpica API (the
// open Ergast successor, no key). One tool with a `kind` switch covers
// the three things people ask by voice: the next race, the last race's
// podium, and the current driver standings. The Ergast JSON is deeply
// nested, so we navigate it as serde_json::Value rather than mirroring
// the whole shape with structs.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_f1_info",
            "description": "F1（フォーミュラ1）の日程・結果・順位を返す。「次のF1いつ？」→kind=next、「前回のF1結果は？」「優勝者は？」→kind=last、「ドライバーランキング教えて」→kind=standings。返り値を自然に読み上げる。kind 未指定なら next。",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["next", "last", "standings"],
                        "description": "next=次戦の日程、last=前回レースの表彰台、standings=現在のドライバーランキング。未指定なら next。"
                    }
                },
                "required": [],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "info" => info(args).await,
        other => json!({ "error": format!("unknown f1 tool: {}", other) }).to_string(),
    }
}

async fn info(args: &Value) -> String {
    let kind = args.get("kind").and_then(|v| v.as_str()).unwrap_or("next");
    let path = match kind {
        "last" => "current/last/results",
        "standings" => "current/driverStandings",
        _ => "current/next",
    };
    let url = format!("https://api.jolpi.ca/ergast/f1/{path}.json");
    let v: Value = match fetch(&url).await {
        Ok(v) => v,
        Err(e) => return json!({ "error": e }).to_string(),
    };
    let data = v.get("MRData");

    match kind {
        "last" => last_results(data),
        "standings" => standings(data),
        _ => next_race(data),
    }
}

async fn fetch(url: &str) -> Result<Value, String> {
    let res = super::HTTP
        .get(url)
        .send()
        .await
        .map_err(|e| format!("f1 request: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    res.json().await.map_err(|e| format!("f1 decode: {e}"))
}

fn next_race(data: Option<&Value>) -> String {
    let race = data
        .and_then(|d| d.get("RaceTable"))
        .and_then(|r| r.get("Races"))
        .and_then(|r| r.as_array())
        .and_then(|a| a.first());
    let Some(race) = race else {
        return json!({ "error": "no upcoming race in the current season" }).to_string();
    };
    let circuit = race.get("Circuit");
    let location = circuit.and_then(|c| c.get("Location"));
    json!({
        "kind": "next",
        "race_name": race.get("raceName").cloned().unwrap_or(Value::Null),
        "round": race.get("round").cloned().unwrap_or(Value::Null),
        "date": race.get("date").cloned().unwrap_or(Value::Null),
        "time": race.get("time").cloned().unwrap_or(Value::Null),
        "circuit": circuit.and_then(|c| c.get("circuitName")).cloned().unwrap_or(Value::Null),
        "country": location.and_then(|l| l.get("country")).cloned().unwrap_or(Value::Null),
        "locality": location.and_then(|l| l.get("locality")).cloned().unwrap_or(Value::Null),
    })
    .to_string()
}

fn last_results(data: Option<&Value>) -> String {
    let race = data
        .and_then(|d| d.get("RaceTable"))
        .and_then(|r| r.get("Races"))
        .and_then(|r| r.as_array())
        .and_then(|a| a.first());
    let Some(race) = race else {
        return json!({ "error": "no last race results available" }).to_string();
    };
    let podium: Vec<Value> = race
        .get("Results")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .take(3)
                .map(|r| {
                    let d = r.get("Driver");
                    let name = format!(
                        "{} {}",
                        d.and_then(|d| d.get("givenName")).and_then(|v| v.as_str()).unwrap_or(""),
                        d.and_then(|d| d.get("familyName")).and_then(|v| v.as_str()).unwrap_or("")
                    );
                    json!({
                        "position": r.get("position").cloned().unwrap_or(Value::Null),
                        "driver": name.trim(),
                        "constructor": r.get("Constructor").and_then(|c| c.get("name")).cloned().unwrap_or(Value::Null),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    json!({
        "kind": "last",
        "race_name": race.get("raceName").cloned().unwrap_or(Value::Null),
        "date": race.get("date").cloned().unwrap_or(Value::Null),
        "podium": podium,
    })
    .to_string()
}

fn standings(data: Option<&Value>) -> String {
    let list = data
        .and_then(|d| d.get("StandingsTable"))
        .and_then(|s| s.get("StandingsLists"))
        .and_then(|s| s.as_array())
        .and_then(|a| a.first());
    let standings: Vec<Value> = list
        .and_then(|l| l.get("DriverStandings"))
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .take(5)
                .map(|s| {
                    let d = s.get("Driver");
                    let name = format!(
                        "{} {}",
                        d.and_then(|d| d.get("givenName")).and_then(|v| v.as_str()).unwrap_or(""),
                        d.and_then(|d| d.get("familyName")).and_then(|v| v.as_str()).unwrap_or("")
                    );
                    json!({
                        "position": s.get("position").cloned().unwrap_or(Value::Null),
                        "points": s.get("points").cloned().unwrap_or(Value::Null),
                        "driver": name.trim(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    if standings.is_empty() {
        return json!({ "error": "no standings available" }).to_string();
    }
    json!({
        "kind": "standings",
        "season": list.and_then(|l| l.get("season")).cloned().unwrap_or(Value::Null),
        "standings": standings,
    })
    .to_string()
}
