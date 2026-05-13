// Foreign exchange rate lookup via open.er-api.com (free, no key,
// daily-ish refresh). Stocks intentionally left out for v1 — Yahoo
// Finance has no stable public JSON endpoint and Alpha Vantage etc.
// require keys. FX alone covers the most common voice query
// ("ドル円" / "ユーロ円").

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_fx_rate",
            "description": "為替レートを取得する。「ドル円教えて」「ユーロは？」「1 ドル何円？」「100 ドルは何円？」。base=元通貨、quote=変換先通貨（どちらも 3 文字 ISO コード、例 USD/JPY/EUR/GBP/CNY/KRW）。amount=任意、未指定なら 1。1 単位あたりのレートと（amount 指定時は）合計を返す。値は日次更新の参考レートなので、為替取引には使わない旨を口頭では添えなくてよい（声がしつこくなる）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "base": {
                        "type": "string",
                        "description": "元通貨の 3 文字 ISO コード（例 USD, EUR, JPY）。"
                    },
                    "quote": {
                        "type": "string",
                        "description": "変換先通貨の 3 文字 ISO コード（例 JPY, USD, EUR）。"
                    },
                    "amount": {
                        "type": "number",
                        "description": "換算額（任意、未指定なら 1）。",
                        "minimum": 0
                    }
                },
                "required": ["base", "quote"],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "rate" => rate(args).await,
        other => json!({ "error": format!("unknown fx tool: {}", other) }).to_string(),
    }
}

async fn rate(args: &Value) -> String {
    let base = args
        .get("base")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_uppercase();
    let quote = args
        .get("quote")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_uppercase();
    if base.len() != 3 || quote.len() != 3 {
        return json!({ "error": "base/quote must be 3-letter ISO codes" }).to_string();
    }
    let amount = args.get("amount").and_then(|v| v.as_f64()).unwrap_or(1.0);

    let url = format!("https://open.er-api.com/v6/latest/{base}");
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
    if body.get("result").and_then(|v| v.as_str()) != Some("success") {
        return json!({
            "error": "api_error",
            "detail": body.get("error-type").cloned().unwrap_or(Value::Null)
        })
        .to_string();
    }

    let rate = body
        .get("rates")
        .and_then(|r| r.get(&quote))
        .and_then(|v| v.as_f64());
    let Some(rate) = rate else {
        return json!({ "error": format!("unknown quote currency: {}", quote) }).to_string();
    };

    json!({
        "base": base,
        "quote": quote,
        "rate": rate,
        "amount": amount,
        "converted": amount * rate,
        "as_of": body.get("time_last_update_utc").cloned().unwrap_or(Value::Null),
        "source": "open.er-api.com",
    })
    .to_string()
}
