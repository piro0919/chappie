// Local unit conversion — temperature / length / weight / volume / speed
// / area. No HTTP, no API key: just an in-process lookup table and
// arithmetic. Covers the Alexa-style "華氏70度って？" / "5マイルって何
// キロ？" voice queries that `fx` (currency only) and free-form LLM
// arithmetic (unreliable past 1 decimal) don't.
//
// The LLM passes unit names as strings; we normalize them to a canonical
// id via `canonicalize()` so synonyms like "celsius" / "摂氏" / "°C" /
// "c" all hit the same row. Temperature is special-cased because it
// needs an offset, not a pure factor.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_units_convert",
            "description": "単位を換算する。「華氏70度は何度？」「5マイルって何キロ？」「100ポンドは何キロ？」「3カップは何ml？」。temperature / length / weight / volume / speed / area に対応。為替（USD/JPY 等）は別の mcp_fx_rate を使う。",
            "parameters": {
                "type": "object",
                "properties": {
                    "from": {
                        "type": "string",
                        "description": "元単位。例: celsius, fahrenheit, kelvin, mm, cm, m, km, inch, foot, yard, mile, mg, g, kg, ton, ounce, pound, ml, liter, fl_oz, cup, pint, gallon, m/s, km/h, mph, knot, m2, km2, ft2, acre, hectare"
                    },
                    "to": {
                        "type": "string",
                        "description": "変換先単位。from と同じカテゴリーである必要がある（温度→温度、長さ→長さ等）。"
                    },
                    "amount": {
                        "type": "number",
                        "description": "換算する数値。"
                    }
                },
                "required": ["from", "to", "amount"],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "convert" => convert(args),
        other => json!({ "error": format!("unknown units tool: {}", other) }).to_string(),
    }
}

fn convert(args: &Value) -> String {
    let from_raw = args.get("from").and_then(|v| v.as_str()).unwrap_or("");
    let to_raw = args.get("to").and_then(|v| v.as_str()).unwrap_or("");
    let amount = match args.get("amount").and_then(|v| v.as_f64()) {
        Some(a) => a,
        None => return json!({ "error": "amount is required" }).to_string(),
    };

    let Some((from_cat, from_unit)) = canonicalize(from_raw) else {
        return json!({ "error": format!("unknown unit: {}", from_raw) }).to_string();
    };
    let Some((to_cat, to_unit)) = canonicalize(to_raw) else {
        return json!({ "error": format!("unknown unit: {}", to_raw) }).to_string();
    };
    if from_cat != to_cat {
        return json!({
            "error": format!("category mismatch: {} ({}) vs {} ({})", from_raw, from_cat, to_raw, to_cat)
        })
        .to_string();
    }

    let result = if from_cat == "temperature" {
        convert_temperature(amount, from_unit, to_unit)
    } else {
        let from_factor = factor(from_unit);
        let to_factor = factor(to_unit);
        amount * from_factor / to_factor
    };

    json!({
        "category": from_cat,
        "from": from_unit,
        "to": to_unit,
        "amount": amount,
        "converted": result,
    })
    .to_string()
}

/// Returns (category, canonical_unit_id). Canonical ids are the strings
/// matched by `factor()` / `convert_temperature()`.
fn canonicalize(raw: &str) -> Option<(&'static str, &'static str)> {
    let s = raw.trim().to_lowercase().replace(' ', "");
    match s.as_str() {
        // ----- temperature -----
        "c" | "°c" | "celsius" | "摂氏" | "セルシウス" | "度" => Some(("temperature", "celsius")),
        "f" | "°f" | "fahrenheit" | "華氏" | "ファーレンハイト" => Some(("temperature", "fahrenheit")),
        "k" | "kelvin" | "ケルビン" => Some(("temperature", "kelvin")),

        // ----- length -----
        "mm" | "millimeter" | "millimetre" | "ミリ" | "ミリメートル" => Some(("length", "mm")),
        "cm" | "centimeter" | "centimetre" | "センチ" | "センチメートル" => Some(("length", "cm")),
        "m" | "meter" | "metre" | "メートル" => Some(("length", "m")),
        "km" | "kilometer" | "kilometre" | "キロ" | "キロメートル" => Some(("length", "km")),
        "in" | "inch" | "inches" | "インチ" => Some(("length", "inch")),
        "ft" | "foot" | "feet" | "フィート" => Some(("length", "foot")),
        "yd" | "yard" | "yards" | "ヤード" => Some(("length", "yard")),
        "mi" | "mile" | "miles" | "マイル" => Some(("length", "mile")),

        // ----- weight -----
        "mg" | "milligram" | "ミリグラム" => Some(("weight", "mg")),
        "g" | "gram" | "グラム" => Some(("weight", "g")),
        "kg" | "kilogram" | "キロ重" | "キログラム" => Some(("weight", "kg")),
        "t" | "ton" | "tonne" | "トン" => Some(("weight", "ton")),
        "oz" | "ounce" | "ounces" | "オンス" => Some(("weight", "ounce")),
        "lb" | "lbs" | "pound" | "pounds" | "ポンド" => Some(("weight", "pound")),

        // ----- volume -----
        "ml" | "milliliter" | "millilitre" | "ミリリットル" => Some(("volume", "ml")),
        "l" | "liter" | "litre" | "リットル" => Some(("volume", "liter")),
        "floz" | "fl_oz" | "fluidounce" | "fluid_ounce" => Some(("volume", "fl_oz")),
        "cup" | "cups" | "カップ" => Some(("volume", "cup")),
        "pt" | "pint" | "pints" | "パイント" => Some(("volume", "pint")),
        "gal" | "gallon" | "gallons" | "ガロン" => Some(("volume", "gallon")),

        // ----- speed -----
        "m/s" | "mps" | "メートル毎秒" => Some(("speed", "m/s")),
        "km/h" | "kmh" | "kph" | "キロメートル毎時" | "時速キロ" => Some(("speed", "km/h")),
        "mph" | "マイル毎時" => Some(("speed", "mph")),
        "knot" | "knots" | "kn" | "kt" | "ノット" => Some(("speed", "knot")),

        // ----- area -----
        "m2" | "m^2" | "平米" | "平方メートル" => Some(("area", "m2")),
        "km2" | "km^2" | "平方キロメートル" => Some(("area", "km2")),
        "ft2" | "ft^2" | "平方フィート" => Some(("area", "ft2")),
        "acre" | "acres" | "エーカー" => Some(("area", "acre")),
        "ha" | "hectare" | "hectares" | "ヘクタール" => Some(("area", "hectare")),
        "坪" | "tsubo" => Some(("area", "tsubo")),

        _ => None,
    }
}

/// Conversion factor TO the category's base unit (m, kg, liter, m/s, m²).
/// Temperature is excluded — see `convert_temperature`.
fn factor(unit: &str) -> f64 {
    match unit {
        // length → meter
        "mm" => 0.001,
        "cm" => 0.01,
        "m" => 1.0,
        "km" => 1000.0,
        "inch" => 0.0254,
        "foot" => 0.3048,
        "yard" => 0.9144,
        "mile" => 1609.344,
        // weight → kilogram
        "mg" => 1e-6,
        "g" => 0.001,
        "kg" => 1.0,
        "ton" => 1000.0,
        "ounce" => 0.028349523125,
        "pound" => 0.45359237,
        // volume → liter
        "ml" => 0.001,
        "liter" => 1.0,
        "fl_oz" => 0.0295735295625, // US fluid ounce
        "cup" => 0.2365882365,       // US cup
        "pint" => 0.473176473,       // US liquid pint
        "gallon" => 3.785411784,     // US liquid gallon
        // speed → m/s
        "m/s" => 1.0,
        "km/h" => 1.0 / 3.6,
        "mph" => 0.44704,
        "knot" => 0.5144444444,
        // area → m²
        "m2" => 1.0,
        "km2" => 1_000_000.0,
        "ft2" => 0.09290304,
        "acre" => 4046.8564224,
        "hectare" => 10_000.0,
        "tsubo" => 3.305785,
        _ => 1.0,
    }
}

fn convert_temperature(amount: f64, from: &str, to: &str) -> f64 {
    let celsius = match from {
        "celsius" => amount,
        "fahrenheit" => (amount - 32.0) * 5.0 / 9.0,
        "kelvin" => amount - 273.15,
        _ => amount,
    };
    match to {
        "celsius" => celsius,
        "fahrenheit" => celsius * 9.0 / 5.0 + 32.0,
        "kelvin" => celsius + 273.15,
        _ => celsius,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-6, "expected {b}, got {a}");
    }

    #[test]
    fn fahrenheit_to_celsius() {
        approx(convert_temperature(70.0, "fahrenheit", "celsius"), 21.111111111);
    }

    #[test]
    fn miles_to_km() {
        let f = factor("mile") / factor("km");
        approx(5.0 * f, 8.04672);
    }

    #[test]
    fn pounds_to_kg() {
        let f = factor("pound") / factor("kg");
        approx(100.0 * f, 45.359237);
    }

    #[test]
    fn cup_to_ml() {
        let f = factor("cup") / factor("ml");
        approx(3.0 * f, 709.7647095);
    }

    #[test]
    fn canonicalize_synonyms() {
        assert_eq!(canonicalize("華氏"), Some(("temperature", "fahrenheit")));
        assert_eq!(canonicalize("°F"), Some(("temperature", "fahrenheit")));
        assert_eq!(canonicalize("マイル"), Some(("length", "mile")));
        assert_eq!(canonicalize("km/h"), Some(("speed", "km/h")));
    }

    #[test]
    fn category_mismatch_rejected() {
        let args = json!({ "from": "kg", "to": "meter", "amount": 1.0 });
        let out = convert(&args);
        assert!(out.contains("category mismatch"));
    }
}
