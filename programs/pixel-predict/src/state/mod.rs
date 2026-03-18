use anchor_lang::prelude::*;

pub mod config_account;
pub mod season_state;
pub mod pixel_state;
pub mod bet_account;
pub mod player_season_stats;

pub use config_account::*;
pub use season_state::*;
pub use pixel_state::*;
pub use bet_account::*;
pub use player_season_stats::*;

/// Season lifecycle status
/// PDA seeds: ["season", season_number.to_le_bytes()]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
#[repr(u8)]
pub enum SeasonStatus {
    Active,
    Completed,
    Intermission,
}

/// Round lifecycle status for each pixel
/// PDA seeds: ["pixel", season_number.to_le_bytes(), pixel_index.to_le_bytes()]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
#[repr(u8)]
pub enum RoundStatus {
    Open,
    Locked,
    Resolved,
}
