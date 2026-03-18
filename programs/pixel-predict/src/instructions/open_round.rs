use anchor_lang::prelude::*;
use crate::state::{ConfigAccount, SeasonState, SeasonStatus, PixelState, RoundStatus};
use crate::errors::PixelPredictError;

#[derive(Accounts)]
#[instruction(pixel_index: u16)]
pub struct OpenRound<'info> {
    #[account(
        mut,
        seeds = [b"season", season_state.season_number.to_le_bytes().as_ref()],
        bump = season_state.bump,
        constraint = season_state.status == SeasonStatus::Active @ PixelPredictError::SeasonNotActive
    )]
    pub season_state: Account<'info, SeasonState>,

    #[account(
        init,
        payer = oracle,
        space = 8 + PixelState::INIT_SPACE,
        seeds = [b"pixel", season_state.season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref()],
        bump
    )]
    pub pixel_state: Account<'info, PixelState>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = oracle @ PixelPredictError::UnauthorizedOracle
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn open_round(
    ctx: Context<OpenRound>,
    pixel_index: u16,
    prompt_hash: [u8; 32],
) -> Result<()> {
    let season_state = &ctx.accounts.season_state;
    let current_pixel_index = season_state.current_pixel_index;

    // Allow opening the current pixel (N) or the next pixel (N+1) — the lookahead for SC-17.
    // The oracle calls open_round twice per round: once for N (with real prompt_hash),
    // once for N+1 (with zeroed or pre-committed hash for future pixel betting).
    // The PDA init constraint ensures each pixel can only be opened once.
    require!(
        pixel_index >= current_pixel_index
            && pixel_index <= current_pixel_index.checked_add(1).unwrap_or(u16::MAX),
        PixelPredictError::InvalidPixelIndex
    );

    let grid_width = season_state.grid_width as u16;
    let x = (pixel_index % grid_width) as u8;
    let y = (pixel_index / grid_width) as u8;
    let clock = Clock::get()?;

    let pixel_state = &mut ctx.accounts.pixel_state;
    pixel_state.season_number = season_state.season_number;
    pixel_state.pixel_index = pixel_index;
    pixel_state.x = x;
    pixel_state.y = y;
    pixel_state.status = RoundStatus::Open;
    pixel_state.color_pools = [0u64; 16];
    pixel_state.total_pool = 0;
    pixel_state.winning_color = None;
    pixel_state.shade = None;
    pixel_state.warmth = None;
    pixel_state.prompt_hash = prompt_hash;
    pixel_state.arweave_txid = [0u8; 43];
    pixel_state.has_arweave_txid = false;
    pixel_state.vrf_resolved = false;
    pixel_state.opened_at = clock.unix_timestamp;
    pixel_state.locked_at = None;
    pixel_state.resolved_at = None;
    pixel_state.bump = ctx.bumps.pixel_state;

    Ok(())
}
