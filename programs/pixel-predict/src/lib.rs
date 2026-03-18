use anchor_lang::prelude::*;

pub mod state;
pub mod constants;
pub mod errors;
pub mod instructions;
pub mod payout;

use instructions::*;

declare_id!("FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG");

#[program]
pub mod pixel_predict {
    use super::*;

    /// Initialize the singleton config PDA with admin and oracle pubkeys.
    /// Must be called once before any season can be started.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        oracle: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::initialize_config(ctx, oracle)
    }

    /// Start a new season by initializing a SeasonState PDA.
    /// Admin-only. Previous season (if any) must be Completed.
    pub fn start_season(
        ctx: Context<StartSeason>,
        season_number: u16,
        grid_width: u8,
        grid_height: u8,
    ) -> Result<()> {
        instructions::start_season::start_season(ctx, season_number, grid_width, grid_height)
    }

    /// Open the next pixel's round for betting.
    /// Oracle-only. Posts prompt_hash on-chain for commit-reveal verifiability.
    /// Accepts pixel_index = current OR current+1 (lookahead for SC-17 future betting).
    pub fn open_round(
        ctx: Context<OpenRound>,
        pixel_index: u16,
        prompt_hash: [u8; 32],
    ) -> Result<()> {
        instructions::open_round::open_round(ctx, pixel_index, prompt_hash)
    }

    /// Place or increase a bet on a color for a specific pixel.
    /// Player-callable. Creates BetAccount and PlayerSeasonStats if needed.
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        pixel_index: u16,
        color: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::place_bet::place_bet(ctx, pixel_index, color, amount)
    }

    /// Lock the round when the 28-minute betting window expires.
    /// Permissionless crank — anyone can call once lockout time is reached.
    pub fn lock_round(ctx: Context<LockRound>, season_number: u16, pixel_index: u16) -> Result<()> {
        instructions::lock_round::lock_round(ctx, season_number, pixel_index)
    }

    /// Resolve the round with AI-determined color, shade, and warmth.
    /// Oracle-only. Transfers rake to treasury and jackpot wallets.
    pub fn resolve_round(
        ctx: Context<ResolveRound>,
        winning_color: u8,
        shade: u8,
        warmth: u8,
        vrf_resolved: bool,
    ) -> Result<()> {
        instructions::resolve_round::resolve_round(ctx, winning_color, shade, warmth, vrf_resolved)
    }

    /// Resolve the round using VRF fallback when AI is unavailable.
    /// Oracle-only. Verifies ORAO VRF proof on-chain (owner check + fulfillment check).
    /// Derives winning_color from randomness[0] % 16, forces shade=50 warmth=50.
    pub fn resolve_round_vrf(ctx: Context<ResolveRoundVrf>) -> Result<()> {
        instructions::resolve_round_vrf::resolve_round_vrf(ctx)
    }

    /// Claim payout for a winning bet.
    /// Player-callable. Validates winning color and transfers payout.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::claim_winnings(ctx)
    }

    /// Update the oracle pubkey in the config PDA.
    /// Admin-only. Allows oracle key rotation without program redeployment.
    pub fn update_oracle(
        ctx: Context<UpdateOracle>,
        new_oracle: Pubkey,
    ) -> Result<()> {
        instructions::update_oracle::update_oracle(ctx, new_oracle)
    }

    /// Write the Arweave transaction ID back to a resolved PixelState.
    /// Oracle-only. Called after uploading the prompt text to Arweave, completing
    /// the commit-reveal chain (prompt hash at open → Arweave upload → txid on-chain).
    pub fn set_arweave_txid(
        ctx: Context<SetArweaveTxid>,
        season_number: u16,
        pixel_index: u16,
        arweave_txid: [u8; 43],
    ) -> Result<()> {
        instructions::set_arweave_txid::set_arweave_txid(ctx, season_number, pixel_index, arweave_txid)
    }
}
