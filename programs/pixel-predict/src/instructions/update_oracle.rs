use anchor_lang::prelude::*;
use crate::state::ConfigAccount;

/// Update the oracle pubkey in the ConfigAccount.
/// Admin-only. Allows oracle key rotation without program redeployment.
///
/// The `has_one = admin` constraint ensures only the current admin can call this.
/// After rotation, the new oracle key takes effect for all subsequent instructions
/// that require oracle authorization (open_round, resolve_round, resolve_round_vrf).
#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, ConfigAccount>,

    pub admin: Signer<'info>,
}

pub fn update_oracle(ctx: Context<UpdateOracle>, new_oracle: Pubkey) -> Result<()> {
    ctx.accounts.config.oracle = new_oracle;
    Ok(())
}
