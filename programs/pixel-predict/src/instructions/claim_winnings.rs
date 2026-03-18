use anchor_lang::prelude::*;
use crate::state::{PixelState, RoundStatus, BetAccount, PlayerSeasonStats};
use crate::errors::PixelPredictError;
use crate::payout::calculate_winner_payout;

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        seeds = [b"pixel", pixel_state.season_number.to_le_bytes().as_ref(), pixel_state.pixel_index.to_le_bytes().as_ref()],
        bump = pixel_state.bump,
        constraint = pixel_state.status == RoundStatus::Resolved @ PixelPredictError::RoundNotResolved
    )]
    pub pixel_state: Account<'info, PixelState>,

    #[account(
        mut,
        seeds = [b"bet", pixel_state.season_number.to_le_bytes().as_ref(), pixel_state.pixel_index.to_le_bytes().as_ref(), player.key().as_ref()],
        bump = bet_account.bump,
        constraint = !bet_account.claimed @ PixelPredictError::AlreadyClaimed,
        constraint = bet_account.player == player.key() @ PixelPredictError::UnauthorizedOracle
    )]
    pub bet_account: Account<'info, BetAccount>,

    #[account(
        mut,
        seeds = [b"stats", pixel_state.season_number.to_le_bytes().as_ref(), player.key().as_ref()],
        bump = player_season_stats.bump
    )]
    pub player_season_stats: Account<'info, PlayerSeasonStats>,

    /// CHECK: player receives lamports
    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let pixel_state = &ctx.accounts.pixel_state;
    let bet_account = &ctx.accounts.bet_account;

    // 1. Verify winner: bet color must match winning color
    // Safe to unwrap: status == Resolved guarantees winning_color is Some
    let winning_color = pixel_state.winning_color.unwrap();
    require!(bet_account.color == winning_color, PixelPredictError::NotWinner);

    // 2. Calculate payout using u128 intermediates
    let payout = calculate_winner_payout(
        bet_account.amount,
        pixel_state.color_pools[winning_color as usize],
        pixel_state.total_pool,
    )?;

    // 3. Rent protection: ensure pixel_state retains minimum rent-exempt lamports
    let rent = Rent::get()?.minimum_balance(pixel_state.to_account_info().data_len());
    let current_lamports = pixel_state.to_account_info().lamports();
    let available = current_lamports
        .checked_sub(rent)
        .ok_or(error!(PixelPredictError::InsufficientFunds))?;
    let actual_payout = payout.min(available);

    // 4. Transfer via direct lamport mutation
    if actual_payout > 0 {
        **ctx.accounts.pixel_state.to_account_info().try_borrow_mut_lamports()? -= actual_payout;
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += actual_payout;
    }

    // 5. Mark bet as claimed
    ctx.accounts.bet_account.claimed = true;

    // 6. Increment correct_predictions (SC-15: updated at claim time, not resolve time)
    ctx.accounts.player_season_stats.correct_predictions = ctx.accounts.player_season_stats
        .correct_predictions
        .checked_add(1)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

    Ok(())
}
