// MCP-style tool registry. v1 servers are in-process Rust modules that
// expose an MCP-shaped surface (tool list + async dispatch by name). The
// abstraction is intentionally MCP-compatible so a future revision can
// swap individual servers for stdio JSON-RPC subprocesses without
// touching the rest of the codebase.
//
// Tool naming: every MCP tool is namespaced as `mcp_<server>_<tool>` so
// dispatch can route by prefix match and MCP tools can never collide
// with native ones.
//
// Adding a new server:
//   1. Create `src/mcp/<name>.rs` with `pub fn tools() -> Vec<Value>`
//      and `pub async fn execute(tool: &str, args: &Value) -> String`.
//   2. Add `mod <name>;` below.
//   3. Append `out.extend(<name>::tools())` in `tools_openai_schema()`.
//   4. Add a prefix arm in `try_execute()`.
//   5. Add a one-line entry per language in `capabilities.rs`.

use serde_json::Value;

mod airquality;
mod anime;
mod astro;
mod aurora;
mod f1;
mod fetch;
mod flights;
mod fx;
mod holidays;
mod iss;
mod marine;
mod mlb;
mod news;
mod pokemon;
mod quake;
mod stocks;
mod units;
mod wiki;

/// OpenAI-shape tool definitions contributed by all registered MCP
/// servers. Appended to `openai::all_tools()` so all 3 providers see
/// them (anthropic / gemini translate from the OpenAI shape).
pub fn tools_openai_schema() -> Vec<Value> {
    let mut out = Vec::new();
    out.extend(airquality::tools());
    out.extend(anime::tools());
    out.extend(aurora::tools());
    out.extend(f1::tools());
    out.extend(flights::tools());
    out.extend(holidays::tools());
    out.extend(iss::tools());
    out.extend(marine::tools());
    out.extend(news::tools());
    out.extend(pokemon::tools());
    out.extend(wiki::tools());
    out.extend(quake::tools());
    out.extend(fx::tools());
    out.extend(astro::tools());
    out.extend(fetch::tools());
    out.extend(mlb::tools());
    out.extend(units::tools());
    out.extend(stocks::tools());
    out
}

/// If `name` belongs to an MCP server, executes the call and returns the
/// tool result as a JSON-shaped string. Returns None for non-MCP tools
/// so the caller can fall through to native dispatch.
pub async fn try_execute(name: &str, args: &Value) -> Option<String> {
    if let Some(rest) = name.strip_prefix("mcp_airquality_") {
        return Some(airquality::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_anime_") {
        return Some(anime::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_aurora_") {
        return Some(aurora::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_f1_") {
        return Some(f1::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_flights_") {
        return Some(flights::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_holidays_") {
        return Some(holidays::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_iss_") {
        return Some(iss::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_marine_") {
        return Some(marine::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_news_") {
        return Some(news::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_pokemon_") {
        return Some(pokemon::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_wiki_") {
        return Some(wiki::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_quake_") {
        return Some(quake::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_fx_") {
        return Some(fx::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_astro_") {
        return Some(astro::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_fetch_") {
        return Some(fetch::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_mlb_") {
        return Some(mlb::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_units_") {
        return Some(units::execute(rest, args).await);
    }
    if let Some(rest) = name.strip_prefix("mcp_stocks_") {
        return Some(stocks::execute(rest, args).await);
    }
    None
}

/// Shared HTTP client for in-process MCP servers. Single Lazy keeps
/// connection pools warm across servers and avoids re-building TLS for
/// each call. 15s default timeout is fine for all current servers
/// (RSS / JSON / readable HTML); raise per-call if a future server
/// needs longer.
pub(crate) static HTTP: once_cell::sync::Lazy<reqwest::Client> =
    once_cell::sync::Lazy::new(|| {
        crate::http::build_client(
            Some(15),
            Some("Chappie/1.0 (+https://github.com/piro0919/chappie)"),
        )
    });
