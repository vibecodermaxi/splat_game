use anchor_lang::prelude::*;

/// Per-player per-season statistics
/// PDA seeds: ["stats", season_number.to_le_bytes(), player.key()]
///
/// Initialized on first bet. correct_predictions updated at claim time (not resolve time)
/// to avoid unbounded compute at resolution.
#[account]
#[derive(InitSpace)]
pub struct PlayerSeasonStats {
    /// Player's public key
    pub player: Pubkey,
    /// Season these stats belong to
    pub season_number: u16,
    /// Total number of bets placed by this player in this season
    pub total_bets: u32,
    /// Total lamports bet by this player in this season
    pub total_volume: u64,
    /// Number of correctly predicted pixels (incremented at claim time)
    pub correct_predictions: u16,
    /// Count of bets placed per color (indexed 0-15)
    pub colors_bet: [u16; 16],
    /// PDA bump seed
    pub bump: u8,
}
