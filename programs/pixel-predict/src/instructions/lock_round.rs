use anchor_lang::prelude::*;
use crate::state::{PixelState, RoundStatus};
use crate::errors::PixelPredictError;
use crate::constants::BETTING_WINDOW_SECONDS;

#[derive(Accounts)]
#[instruction(season_number: u16, pixel_index: u16)]
pub struct LockRound<'info> {
    #[account(
        mut,
        seeds = [b"pixel", season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref()],
        bump = pixel_state.bump,
        constraint = pixel_state.status == RoundStatus::Open @ PixelPredictError::RoundNotOpen
    )]
    pub pixel_state: Account<'info, PixelState>,

    /// Fee payer for the transaction — permissionless, any account can crank this
    #[account(mut)]
    pub caller: Signer<'info>,
}

pub fn lock_round(ctx: Context<LockRound>, _season_number: u16, _pixel_index: u16) -> Result<()> {
    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp >= ctx.accounts.pixel_state.opened_at + BETTING_WINDOW_SECONDS,
        PixelPredictError::LockoutNotReached
    );

    let pixel_state = &mut ctx.accounts.pixel_state;
    pixel_state.status = RoundStatus::Locked;
    pixel_state.locked_at = Some(clock.unix_timestamp);

    Ok(())
}
