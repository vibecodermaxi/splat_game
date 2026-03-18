use anchor_lang::prelude::*;
use crate::state::{PixelState, RoundStatus};
use crate::errors::PixelPredictError;

/// Set the Arweave transaction ID on a resolved pixel.
/// Oracle-only. Called after uploading the prompt text to Arweave,
/// completing the commit-reveal chain (prompt hash → Arweave upload → txid on-chain).
#[derive(Accounts)]
#[instruction(season_number: u16, pixel_index: u16)]
pub struct SetArweaveTxid<'info> {
    /// The pixel state to update — must be in Resolved status.
    /// Seeds use instruction args (same pattern as lock_round) to avoid
    /// self-referential PDA validation failure in Anchor 0.32.
    #[account(
        mut,
        seeds = [b"pixel", season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref()],
        bump = pixel_state.bump,
        constraint = pixel_state.status == RoundStatus::Resolved @ PixelPredictError::RoundNotResolved
    )]
    pub pixel_state: Account<'info, PixelState>,

    /// Config PDA — provides oracle authorization via has_one constraint.
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = oracle
    )]
    pub config: Account<'info, crate::state::ConfigAccount>,

    /// Oracle signer — must match the oracle pubkey stored in config.
    pub oracle: Signer<'info>,
}

/// Write the Arweave transaction ID back to a resolved PixelState.
///
/// Args:
///   - `season_number`: Used for PDA seed derivation (Anchor constraint pattern).
///   - `pixel_index`: Used for PDA seed derivation (Anchor constraint pattern).
///   - `arweave_txid`: 43-byte base58 Arweave transaction ID.
pub fn set_arweave_txid(
    ctx: Context<SetArweaveTxid>,
    _season_number: u16,
    _pixel_index: u16,
    arweave_txid: [u8; 43],
) -> Result<()> {
    let pixel_state = &mut ctx.accounts.pixel_state;

    pixel_state.arweave_txid = arweave_txid;
    pixel_state.has_arweave_txid = true;

    Ok(())
}
