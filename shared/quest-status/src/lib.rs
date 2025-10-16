pub const PUBLIC_QUEST_STATUSES: &[&str] = &["published", "approved"];

pub fn public_statuses() -> Vec<String> {
    PUBLIC_QUEST_STATUSES.iter().map(|status| status.to_string()).collect()
}
