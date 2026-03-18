use anchor_lang::prelude::*;
use crate::state::{ConfigAccount, SeasonState, SeasonStatus};
use crate::errors::PixelPredictError;

#[derive(Accounts)]
#[instruction(season_number: u16)]
pub struct StartSeason<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + SeasonState::INIT_SPACE,
        seeds = [b"season", season_number.to_le_bytes().as_ref()],
        bump
    )]
    pub season_state: Account<'info, SeasonState>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ PixelPredictError::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn start_season(
    ctx: Context<StartSeason>,
    season_number: u16,
    grid_width: u8,
    grid_height: u8,
) -> Result<()> {
    // NOTE: For season_number > 1, ideally we would check that the previous season
    // (season_number - 1) is completed. However, since the previous SeasonState PDA
    // has different seeds, checking it would require passing it as an optional account.
    // For v1, we trust the admin to only start seasons sequentially.

    let season_state = &mut ctx.accounts.season_state;
    let clock = Clock::get()?;

    season_state.season_number = season_number;
    season_state.grid_width = grid_width;
    season_state.grid_height = grid_height;
    season_state.current_pixel_index = 0;
    season_state.status = SeasonStatus::Active;
    season_state.total_volume = 0;
    season_state.total_bets = 0;
    season_state.unique_wallets = 0;
    season_state.created_at = clock.unix_timestamp;
    season_state.completed_at = None;
    season_state.bump = ctx.bumps.season_state;

    Ok(())
}
