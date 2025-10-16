pub mod queries;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TimeWindow {
    Hour,
    Day,
    Week,
}

impl Default for TimeWindow {
    fn default() -> Self {
        TimeWindow::Day
    }
}

impl TimeWindow {
    pub fn as_trunc_parameter(&self) -> &'static str {
        match self {
            TimeWindow::Hour => "hour",
            TimeWindow::Day => "day",
            TimeWindow::Week => "week",
        }
    }

    pub fn bucket_end(&self, start: DateTime<Utc>) -> DateTime<Utc> {
        let duration = match self {
            TimeWindow::Hour => Duration::hours(1),
            TimeWindow::Day => Duration::days(1),
            TimeWindow::Week => Duration::weeks(1),
        };
        start + duration
    }
}
