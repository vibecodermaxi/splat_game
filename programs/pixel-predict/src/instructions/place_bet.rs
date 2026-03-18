use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{SeasonState, SeasonStatus, PixelState, RoundStatus, BetAccount, PlayerSeasonStats};
use crate::errors::PixelPredictError;
use crate::constants::{NUM_COLORS, MIN_BET, MAX_BET_PER_COLOR, BETTING_WINDOW_SECONDS};

#[derive(Accounts)]
#[instruction(pixel_index: u16, color: u8, amount: u64)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"season", season_state.season_number.to_le_bytes().as_ref()],
        bump = season_state.bump,
        constraint = season_state.status == SeasonStatus::Active @ PixelPredictError::SeasonNotActive
    )]
    pub season_state: Account<'info, SeasonState>,

    #[account(
        mut,
        seeds = [b"pixel", season_state.season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref()],
        bump = pixel_state.bump,
        constraint = pixel_state.status == RoundStatus::Open @ PixelPredictError::RoundNotOpen
    )]
    pub pixel_state: Account<'info, PixelState>,

    #[account(
        init_if_needed,
        payer = player,
        space = 8 + BetAccount::INIT_SPACE,
        seeds = [b"bet", season_state.season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref(), player.key().as_ref()],
        bump
    )]
    pub bet_account: Account<'info, BetAccount>,

    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerSeasonStats::INIT_SPACE,
        seeds = [b"stats", season_state.season_number.to_le_bytes().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_season_stats: Account<'info, PlayerSeasonStats>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn place_bet(
    ctx: Context<PlaceBet>,
    pixel_index: u16,
    color: u8,
    amount: u64,
) -> Result<()> {
    // 0. Re-init guard: ensure bet hasn't been claimed (prevents re-betting on closed rounds)
    require!(!ctx.accounts.bet_account.claimed, PixelPredictError::AlreadyClaimed);

    // 1. Validate color is in range 0-15
    require!(color < NUM_COLORS, PixelPredictError::InvalidColor);

    // 2. Validate bet amount meets minimum
    require!(amount >= MIN_BET, PixelPredictError::BetTooSmall);

    // 3. Lockout check: betting window must still be open
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.pixel_state.opened_at + BETTING_WINDOW_SECONDS,
        PixelPredictError::BettingLocked
    );

    let bet_account = &mut ctx.accounts.bet_account;

    // 4. If existing bet: validate color matches (no color switching)
    let is_new_bet = bet_account.player == Pubkey::default();
    if !is_new_bet {
        require!(bet_account.color == color, PixelPredictError::ColorMismatch);
    }

    // 5. Validate cumulative max bet per color
    let new_total = bet_account.amount
        .checked_add(amount)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;
    require!(new_total <= MAX_BET_PER_COLOR, PixelPredictError::BetTooLarge);

    // 6. Transfer SOL from player to pixel_state PDA via system_program CPI
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.player.to_account_info(),
            to: ctx.accounts.pixel_state.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    // 7. Update bet_account
    if is_new_bet {
        bet_account.player = ctx.accounts.player.key();
        bet_account.season_number = ctx.accounts.season_state.season_number;
        bet_account.pixel_index = pixel_index;
        bet_account.color = color;
        bet_account.claimed = false;
        bet_account.bump = ctx.bumps.bet_account;
    }
    bet_account.amount = new_total;

    // 8. Update pixel_state color pools
    let pixel_state = &mut ctx.accounts.pixel_state;
    pixel_state.color_pools[color as usize] = pixel_state.color_pools[color as usize]
        .checked_add(amount)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;
    pixel_state.total_pool = pixel_state.total_pool
        .checked_add(amount)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;

    // 9. Update player_season_stats
    let stats = &mut ctx.accounts.player_season_stats;
    if is_new_bet && stats.total_bets == 0 {
        // First ever bet by this player in this season
        stats.player = ctx.accounts.player.key();
        stats.season_number = ctx.accounts.season_state.season_number;
        stats.bump = ctx.bumps.player_season_stats;
        // Increment unique_wallets on season
        ctx.accounts.season_state.unique_wallets = ctx.accounts.season_state.unique_wallets
            .checked_add(1)
            .ok_or(PixelPredictError::ArithmeticOverflow)?;
    }
    stats.total_bets = stats.total_bets
        .checked_add(1)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;
    stats.total_volume = stats.total_volume
        .checked_add(amount)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;
    stats.colors_bet[color as usize] = stats.colors_bet[color as usize]
        .checked_add(1)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;

    // 10. Update season_state aggregates
    let season_state = &mut ctx.accounts.season_state;
    season_state.total_volume = season_state.total_volume
        .checked_add(amount)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;
    season_state.total_bets = season_state.total_bets
        .checked_add(1)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;

    Ok(())
}
