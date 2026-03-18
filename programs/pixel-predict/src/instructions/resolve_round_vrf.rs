use anchor_lang::prelude::*;
use crate::state::{SeasonState, SeasonStatus, PixelState, RoundStatus};
use crate::errors::PixelPredictError;
use crate::constants::{
    NUM_COLORS, TREASURY_BPS, JACKPOT_BPS, TREASURY_WALLET, JACKPOT_WALLET,
    SWITCHBOARD_RANDOMNESS_PROGRAM, SWITCHBOARD_RANDOMNESS_DISCRIMINATOR,
    SWITCHBOARD_RANDOMNESS_VALUE_OFFSET,
};

/// On-chain VRF proof verification approach (Switchboard On-Demand v3):
///
/// Switchboard On-Demand creates `RandomnessAccountData` accounts when fulfilling
/// randomness requests. We verify:
///   (a) The account is owned by SWITCHBOARD_RANDOMNESS_PROGRAM (not spoofable — owner
///       is set by the runtime; no one can forge an account with the wrong owner)
///   (b) The discriminator matches the Switchboard Randomness account discriminator
///       (prevents passing arbitrary Switchboard-owned accounts that aren't randomness)
///   (c) The `value` bytes are non-zero (all-zero = pending, non-zero = fulfilled)
///   (d) The winning color is derived deterministically: value[0] % 16
///
/// Switchboard RandomnessAccountData layout:
///   [0..8]   = 8-byte Anchor discriminator
///   [8..40]  = queue: Pubkey (32 bytes)
///   [40..72] = seed: [u8; 32] (32 bytes)
///   [72..80] = expiration_slot: u64 (8 bytes)
///   [80..144] = value: [u8; 64] (64 bytes of random data)
#[derive(Accounts)]
pub struct ResolveRoundVrf<'info> {
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

    /// CHECK: Switchboard On-Demand randomness account.
    /// On-chain proof verification: account must be owned by the Switchboard randomness program.
    /// The owner constraint is enforced by the Anchor runtime — any account not created by
    /// Switchboard's program will have a different owner and this instruction will reject it.
    /// The data is then read manually to verify the discriminator and fulfillment status
    /// (non-zero value bytes = fulfilled).
    #[account(owner = SWITCHBOARD_RANDOMNESS_PROGRAM @ PixelPredictError::InvalidVrfAccount)]
    pub randomness_account: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Extract fulfilled randomness from a Switchboard On-Demand v3 RandomnessAccountData.
///
/// Returns Ok(first_byte) if fulfilled, Err if pending or invalid.
///
/// Switchboard RandomnessAccountData layout:
///   [0..8]    = 8-byte discriminator (sha256("account:RandomnessAccountData")[0..8])
///   [8..40]   = queue: Pubkey (32 bytes)
///   [40..72]  = seed: [u8; 32] (32 bytes)
///   [72..80]  = expiration_slot: u64 (8 bytes, little-endian)
///   [80..144] = value: [u8; 64] (random bytes; all-zero = pending, non-zero = fulfilled)
fn extract_switchboard_randomness(data: &[u8]) -> Result<u8> {
    let required_len = SWITCHBOARD_RANDOMNESS_VALUE_OFFSET + 64;
    if data.len() < required_len {
        return Err(error!(PixelPredictError::InvalidVrfAccount));
    }

    // Verify discriminator
    let discriminator = &data[0..8];
    if discriminator != &SWITCHBOARD_RANDOMNESS_DISCRIMINATOR {
        return Err(error!(PixelPredictError::InvalidVrfAccount));
    }

    // Read the value field (64 bytes)
    let value = &data[SWITCHBOARD_RANDOMNESS_VALUE_OFFSET..SWITCHBOARD_RANDOMNESS_VALUE_OFFSET + 64];

    // All-zero value = pending (not yet fulfilled by the oracle network)
    if value.iter().all(|&b| b == 0) {
        return Err(error!(PixelPredictError::VrfNotFulfilled));
    }

    Ok(value[0])
}

pub fn resolve_round_vrf(ctx: Context<ResolveRoundVrf>) -> Result<()> {
    // 1. Read and verify the Switchboard randomness account
    let randomness_data = ctx.accounts.randomness_account.data.borrow();
    let first_randomness_byte = extract_switchboard_randomness(&randomness_data)?;
    drop(randomness_data);

    // 2. Derive winning color from VRF output: value[0] % NUM_COLORS
    let winning_color = first_randomness_byte % NUM_COLORS;

    // 3. Set resolution fields
    // VRF-resolved rounds always use shade=50, warmth=50 (no oracle discretion)
    let clock = Clock::get()?;
    let pixel_state = &mut ctx.accounts.pixel_state;

    pixel_state.winning_color = Some(winning_color);
    pixel_state.shade = Some(50);
    pixel_state.warmth = Some(50);
    pixel_state.vrf_resolved = true;
    pixel_state.status = RoundStatus::Resolved;
    pixel_state.resolved_at = Some(clock.unix_timestamp);

    // 4. Calculate rake and transfer to treasury/jackpot
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

    // 5. Zero-winner branch (SC-13): no one bet on winning color, send net pool to treasury
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

    // 6. Season completion: advance current_pixel_index and check completion
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
