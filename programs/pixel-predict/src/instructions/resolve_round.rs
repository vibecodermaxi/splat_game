use anchor_lang::prelude::*;
use crate::state::{SeasonState, SeasonStatus, PixelState, RoundStatus};
use crate::errors::PixelPredictError;
use crate::constants::{NUM_COLORS, TREASURY_BPS, JACKPOT_BPS, TREASURY_WALLET, JACKPOT_WALLET};

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    #[account(
        mut,
        seeds = [b"season", season_state.season_number.to_le_bytes().as_ref()],
        bump = season_state.bump,
        constraint = season_state.status == SeasonStatus::Active @ PixelPredictError::SeasonNotActive
    )]
    pub season_state: Account<'info, SeasonState>,

    #[account(
        mut,
        seeds = [b"pixel", season_state.season_number.to_le_bytes().as_ref(), pixel_state.pixel_index.to_le_bytes().as_ref()],
        bump = pixel_state.bump,
        constraint = (pixel_state.status == RoundStatus::Open || pixel_state.status == RoundStatus::Locked) @ PixelPredictError::RoundNotOpen,
        constraint = pixel_state.winning_color.is_none() @ PixelPredictError::RoundAlreadyResolved
    )]
    pub pixel_state: Account<'info, PixelState>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = oracle
    )]
    pub config: Account<'info, crate::state::ConfigAccount>,

    pub oracle: Signer<'info>,

    /// CHECK: Treasury wallet — verified against program constant
    #[account(mut, address = TREASURY_WALLET @ PixelPredictError::InvalidTreasury)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Jackpot wallet — verified against program constant
    #[account(mut, address = JACKPOT_WALLET @ PixelPredictError::InvalidJackpot)]
    pub jackpot: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_round(
    ctx: Context<ResolveRound>,
    winning_color: u8,
    shade: u8,
    warmth: u8,
    vrf_resolved: bool,
) -> Result<()> {
    // 1. Validate inputs
    require!(winning_color < NUM_COLORS, PixelPredictError::InvalidColor);
    require!(shade <= 100, PixelPredictError::InvalidShade);
    require!(warmth <= 100, PixelPredictError::InvalidWarmth);

    let clock = Clock::get()?;
    let pixel_state = &mut ctx.accounts.pixel_state;

    // 2. Set resolution fields
    pixel_state.winning_color = Some(winning_color);
    pixel_state.shade = Some(shade);
    pixel_state.warmth = Some(warmth);
    pixel_state.vrf_resolved = vrf_resolved;
    pixel_state.status = RoundStatus::Resolved;
    pixel_state.resolved_at = Some(clock.unix_timestamp);

    // 3. Calculate rake and transfer to treasury/jackpot
    let total_pool = pixel_state.total_pool;
    let mut treasury_cut: u64 = 0;
    let mut jackpot_cut: u64 = 0;

    if total_pool > 0 {
        treasury_cut = (total_pool as u128)
            .checked_mul(TREASURY_BPS as u128)
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))?
            .checked_div(10_000)
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))? as u64;
        jackpot_cut = (total_pool as u128)
            .checked_mul(JACKPOT_BPS as u128)
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))?
            .checked_div(10_000)
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))? as u64;
        let rake = treasury_cut
            .checked_add(jackpot_cut)
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

        // Direct lamport mutation (pixel_state is a program-owned account)
        **pixel_state.to_account_info().try_borrow_mut_lamports()? -= rake;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += treasury_cut;
        **ctx.accounts.jackpot.to_account_info().try_borrow_mut_lamports()? += jackpot_cut;
    }

    // 4. Zero-winner branch (SC-13): no one bet on winning color, send net pool to treasury
    let winning_pool = pixel_state.color_pools[winning_color as usize];
    if winning_pool == 0 && total_pool > 0 {
        let net_pool = total_pool
            .checked_sub(
                treasury_cut
                    .checked_add(jackpot_cut)
                    .ok_or(error!(PixelPredictError::ArithmeticOverflow))?
            )
            .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

        // Ensure we retain rent-exempt minimum in pixel_state
        let rent = Rent::get()?.minimum_balance(pixel_state.to_account_info().data_len());
        let current_lamports = pixel_state.to_account_info().lamports();
        let available = current_lamports
            .checked_sub(rent)
            .ok_or(error!(PixelPredictError::InsufficientFunds))?;
        let transfer_amount = net_pool.min(available);

        if transfer_amount > 0 {
            **pixel_state.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;
        }
    }

    // 5. Season completion (SC-14): advance current_pixel_index and check completion
    let season_state = &mut ctx.accounts.season_state;
    season_state.current_pixel_index = season_state.current_pixel_index
        .checked_add(1)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

    let total_pixels = (season_state.grid_width as u16)
        .checked_mul(season_state.grid_height as u16)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

    if season_state.current_pixel_index >= total_pixels {
        season_state.status = SeasonStatus::Completed;
        season_state.completed_at = Some(clock.unix_timestamp);
    }

    Ok(())
}
