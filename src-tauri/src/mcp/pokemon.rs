// Pokémon base stats / types via PokéAPI (pokeapi.co, no key). PokéAPI
// resolves by English slug or national-dex id, not by localized name, so
// the tool description asks the LLM to pass the English name (it maps
// "ピカチュウ" → "pikachu" reliably). We label the six base stats in
// Japanese on the way out so the spoken reply reads naturally.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_pokemon_stats",
            "description": "ポケモンの種族値・タイプ・特性を返す。「ピカチュウの種族値は？」「リザードンのタイプは？」「ミュウツーのステータス教えて」。name には英語名（小文字スラッグ）を渡す（例: ピカチュウ→pikachu、リザードン→charizard、ミュウツー→mewtwo）。**変換は必ず自分で行い、ユーザーに英語名やスラッグを聞き返してはいけない**（ユーザーは日本語名しか言わない前提）。返り値の stats（HP・こうげき・ぼうぎょ・とくこう・とくぼう・すばやさ）と types を読み上げる。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "ポケモンの英語名スラッグ（小文字）または全国図鑑番号。例: pikachu, charizard, mewtwo, 25。"
                    }
                },
                "required": ["name"],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "stats" => stats(args).await,
        other => json!({ "error": format!("unknown pokemon tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct Pokemon {
    name: String,
    id: u32,
    height: u32, // decimetres
    weight: u32, // hectograms
    stats: Vec<StatEntry>,
    types: Vec<TypeEntry>,
}

#[derive(Deserialize)]
struct StatEntry {
    base_stat: i64,
    stat: NamedRef,
}

#[derive(Deserialize)]
struct TypeEntry {
    #[serde(rename = "type")]
    type_: NamedRef,
}

#[derive(Deserialize)]
struct NamedRef {
    name: String,
}

async fn stats(args: &Value) -> String {
    let name = args
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if name.is_empty() {
        return json!({ "error": "name is empty" }).to_string();
    }

    let url = format!("https://pokeapi.co/api/v2/pokemon/{}", urlencoding::encode(&name));
    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("pokeapi request: {e}") }).to_string(),
    };
    if res.status().as_u16() == 404 {
        return json!({ "error": "not_found", "name": name }).to_string();
    }
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let p: Pokemon = match res.json().await {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("pokeapi decode: {e}") }).to_string(),
    };

    let mut out = serde_json::Map::new();
    let mut total = 0i64;
    for s in &p.stats {
        total += s.base_stat;
        out.insert(stat_label_ja(&s.stat.name).to_string(), json!(s.base_stat));
    }
    let types: Vec<String> = p.types.iter().map(|t| type_label_ja(&t.type_.name)).collect();

    json!({
        "name": p.name,
        "id": p.id,
        "types": types,
        "stats": out,
        "total": total,
        "height_m": p.height as f64 / 10.0,
        "weight_kg": p.weight as f64 / 10.0,
    })
    .to_string()
}

fn stat_label_ja(name: &str) -> &'static str {
    match name {
        "hp" => "HP",
        "attack" => "こうげき",
        "defense" => "ぼうぎょ",
        "special-attack" => "とくこう",
        "special-defense" => "とくぼう",
        "speed" => "すばやさ",
        _ => "その他",
    }
}

fn type_label_ja(name: &str) -> String {
    let label = match name {
        "normal" => "ノーマル",
        "fire" => "ほのお",
        "water" => "みず",
        "electric" => "でんき",
        "grass" => "くさ",
        "ice" => "こおり",
        "fighting" => "かくとう",
        "poison" => "どく",
        "ground" => "じめん",
        "flying" => "ひこう",
        "psychic" => "エスパー",
        "bug" => "むし",
        "rock" => "いわ",
        "ghost" => "ゴースト",
        "dragon" => "ドラゴン",
        "dark" => "あく",
        "steel" => "はがね",
        "fairy" => "フェアリー",
        // Unknown / future type: keep the original English name.
        other => return other.to_string(),
    };
    label.to_string()
}
