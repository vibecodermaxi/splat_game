use anchor_lang::prelude::*;

/// Individual bet by a player on a specific pixel
/// PDA seeds: ["bet", season_number.to_le_bytes(), pixel_index.to_le_bytes(), player.key()]
///
/// One bet account per (player, pixel) pair — players must commit to a single color per pixel.
/// Amount can be increased (via place_bet again) until betting locks.
#[account]
#[derive(InitSpace)]
pub struct BetAccount {
    /// Player who placed this bet
    pub player: Pubkey,
    /// Season this bet belongs to
    pub season_number: u16,
    /// Pixel this bet is for (0-99)
    pub pixel_index: u16,
    /// Color this player bet on (0-15) — cannot be changed after initial bet
    pub color: u8,
    /// Total lamports bet by this player on this pixel (can increase up to MAX_BET_PER_COLOR)
    pub amount: u64,
    /// True if winnings have been claimed — prevents double-claiming
    pub claimed: bool,
    /// PDA bump seed
    pub bump: u8,
}
