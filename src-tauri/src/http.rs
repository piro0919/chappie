// Tiny factory for the per-module reqwest clients. Six modules
// (openai, anthropic, gemini, voicevox, weather, location, mcp) each
// declared the same `Lazy::new(|| reqwest::Client::builder().timeout(X).build().expect(...))`
// boilerplate with only the timeout (and occasional user-agent) differing.
//
// Each call site still owns its own `Lazy<reqwest::Client>` so the
// connection pool is scoped per consumer — sharing one global pool
// across an LLM streaming call and a 5s weather lookup would couple
// their failure modes. The factory just removes the .builder().build().expect()
// ritual.

use reqwest::Client;
use std::time::Duration;

/// Build a reqwest client with an optional request timeout and an
/// optional `User-Agent` header. Panics on builder failure — reqwest's
/// builder only fails when no TLS backend compiles in, which would be
/// a hard build error rather than a runtime condition.
pub fn build_client(timeout_secs: Option<u64>, user_agent: Option<&str>) -> Client {
    let mut b = Client::builder();
    if let Some(t) = timeout_secs {
        b = b.timeout(Duration::from_secs(t));
    }
    if let Some(ua) = user_agent {
        b = b.user_agent(ua);
    }
    b.build().expect("failed to build reqwest client")
}
