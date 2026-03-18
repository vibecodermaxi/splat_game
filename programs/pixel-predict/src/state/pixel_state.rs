use anchor_lang::prelude::*;
use crate::state::RoundStatus;

/// Pixel round state — one entry per pixel per season
/// PDA seeds: ["pixel", season_number.to_le_bytes(), pixel_index.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct PixelState {
    /// Season this pixel belongs to
    pub season_number: u16,
    /// Sequential pixel index within the season (0-99)
    /// Maps to canvas position: x = pixel_index % grid_width, y = pixel_index / grid_width
    pub pixel_index: u16,
    /// X coordinate on canvas (0-9)
    pub x: u8,
    /// Y coordinate on canvas (0-9)
    pub y: u8,
    /// Current round lifecycle status
    pub status: RoundStatus,
    /// Lamports bet per color (indexed 0-15 matching the 16 game colors)
    pub color_pools: [u64; 16],
    /// Sum of all color_pools — total lamports in this round's pool
    pub total_pool: u64,
    /// Winning color index (0-15), None until round is Resolved
    pub winning_color: Option<u8>,
    /// Visual shade modifier (0-100), None until round is Resolved
    pub shade: Option<u8>,
    /// Visual warmth modifier (0-100), None until round is Resolved
    pub warmth: Option<u8>,
    /// SHA-256 hash of the full AI prompt pre-committed at round open
    /// Enables commit-reveal verifiability
    pub prompt_hash: [u8; 32],
    /// Arweave transaction ID where the full prompt text is stored (43 bytes, base58)
    /// All zeros means not yet uploaded — check has_arweave_txid flag
    pub arweave_txid: [u8; 43],
    /// True when arweave_txid has been set (since [u8; 43] cannot use Option<> with InitSpace)
    pub has_arweave_txid: bool,
    /// True if VRF fallback was used for resolution (AI was unavailable)
    pub vrf_resolved: bool,
    /// Unix timestamp when round was opened for betting
    pub opened_at: i64,
    /// Unix timestamp when round was locked (28-min window elapsed), None until locked
    pub locked_at: Option<i64>,
    /// Unix timestamp when round was resolved, None until resolved
    pub resolved_at: Option<i64>,
    /// PDA bump seed
    pub bump: u8,
}
