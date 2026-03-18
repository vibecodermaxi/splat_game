use anchor_lang::prelude::*;
use crate::state::SeasonStatus;

/// Season state — one entry per season (100 pixels per season)
/// PDA seeds: ["season", season_number.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct SeasonState {
    /// Sequential season identifier (Season 1, 2, 3, ...)
    pub season_number: u16,
    /// Grid width in pixels (always 10 for v1)
    pub grid_width: u8,
    /// Grid height in pixels (always 10 for v1)
    pub grid_height: u8,
    /// Index of the current/next pixel to be painted (0-99)
    pub current_pixel_index: u16,
    /// Current season lifecycle status
    pub status: SeasonStatus,
    /// Cumulative lamports bet across all rounds
    pub total_volume: u64,
    /// Cumulative number of bets placed
    pub total_bets: u32,
    /// Number of distinct wallets that have bet in this season
    pub unique_wallets: u32,
    /// Unix timestamp when season was created
    pub created_at: i64,
    /// Unix timestamp when season was completed (None if still active)
    pub completed_at: Option<i64>,
    /// PDA bump seed
    pub bump: u8,
}
