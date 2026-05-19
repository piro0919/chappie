// Stock / index / crypto quote lookup via Stooq's free CSV endpoint
// (no key, ~15min delayed for US equities — fine for the voice use
// case "アップルの株価教えて" / "日経平均は？"). Single tool, single
// symbol per call — chaining is the LLM's job.
//
// Symbol formats Stooq accepts:
//   - US equities:  `aapl.us`, `googl.us`, `tsla.us`
//   - JP equities:  `7203.jp` (Toyota), `9984.jp` (SoftBank)
//   - Indices:      `^spx` (S&P 500), `^dji` (Dow), `^ixic` (Nasdaq),
//                   `^nkx` (Nikkei 225), `^topix`
//   - Crypto:       `btcusd`, `ethusd`, `btcjpy`
//
// The LLM resolves "アップル" → "aapl.us" / "日経" → "^nkx" from the
// description examples; we don't maintain a name table here.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_stocks_quote",
            "description": "株価・指数・暗号資産のレートを取得（Stooq、US 株は約 15 分遅延、無料・無 key）。symbol は Stooq 形式: 米株 `aapl.us` / `googl.us`、日本株 `7203.jp` (トヨタ)、指数 `^spx` (S&P500) / `^dji` (ダウ) / `^ixic` (Nasdaq) / `^nkx` (日経平均)、暗号資産 `btcusd` / `ethusd`。為替は別の mcp_fx_rate を使う。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Stooq のティッカー。米株は .us、日本株は .jp、指数は ^prefix。"
                    }
                },
                "required": ["symbol"],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "quote" => quote(args).await,
        other => json!({ "error": format!("unknown stocks tool: {}", other) }).to_string(),
    }
}

async fn quote(args: &Value) -> String {
    let symbol = args
        .get("symbol")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if symbol.is_empty() {
        return json!({ "error": "symbol is required" }).to_string();
    }

    // Stooq lite CSV. Fields: s n d t o h l c v p (% change).
    let url = format!(
        "https://stooq.com/q/l/?s={}&f=sd2t2ohlcvn&h&e=csv",
        urlencode(&symbol)
    );
    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("fetch failed: {}", e) }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let body = match res.text().await {
        Ok(t) => t,
        Err(e) => return json!({ "error": format!("read failed: {}", e) }).to_string(),
    };

    // CSV: two lines (header + one row). Split on the first newline.
    let mut lines = body.lines();
    let header = lines.next().unwrap_or("");
    let row = lines.next().unwrap_or("");
    if row.is_empty() {
        return json!({ "error": "empty response", "raw": body }).to_string();
    }
    let headers: Vec<&str> = header.split(',').collect();
    let values: Vec<&str> = row.split(',').collect();
    if headers.len() != values.len() {
        return json!({ "error": "csv shape mismatch", "raw": body }).to_string();
    }

    // Stooq returns "N/D" in every numeric column when the symbol is
    // unknown. Catch that early so the caller doesn't see "Close: N/D".
    if values.iter().any(|v| *v == "N/D") {
        return json!({
            "error": "symbol_not_found",
            "symbol": symbol,
        })
        .to_string();
    }

    let mut out = serde_json::Map::new();
    for (h, v) in headers.iter().zip(values.iter()) {
        let key = match *h {
            "Symbol" => "symbol",
            "Name" => "name",
            "Date" => "date",
            "Time" => "time",
            "Open" => "open",
            "High" => "high",
            "Low" => "low",
            "Close" => "close",
            "Volume" => "volume",
            other => {
                // Skip unknown columns instead of polluting the object.
                let _ = other;
                continue;
            }
        };
        // Numerics get parsed as f64 so the LLM can format them; fall
        // back to string when the field isn't numeric (Symbol / Name /
        // Date / Time).
        let val = v.parse::<f64>().map(Value::from).unwrap_or_else(|_| Value::String((*v).to_string()));
        out.insert(key.into(), val);
    }
    out.insert("source".into(), Value::String("stooq.com".into()));
    out.insert(
        "note".into(),
        Value::String("delayed quote, not for trading".into()),
    );
    Value::Object(out).to_string()
}

/// Minimal URL-encoder for the symbol field. Stooq tickers only ever
/// contain `[A-Za-z0-9._^]` in practice, so we only need to escape `^`
/// (the index prefix) and `.` is safe as-is.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '.' | '-' | '_' => out.push(c),
            other => {
                let mut buf = [0u8; 4];
                for byte in other.encode_utf8(&mut buf).bytes() {
                    out.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencode_caret() {
        assert_eq!(urlencode("^spx"), "%5Espx");
    }

    #[test]
    fn urlencode_plain() {
        assert_eq!(urlencode("aapl.us"), "aapl.us");
        assert_eq!(urlencode("7203.jp"), "7203.jp");
    }
}
