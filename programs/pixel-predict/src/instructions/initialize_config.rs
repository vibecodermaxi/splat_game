use anchor_lang::prelude::*;
use crate::state::ConfigAccount;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ConfigAccount::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config(ctx: Context<InitializeConfig>, oracle_pubkey: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.oracle = oracle_pubkey;
    config.bump = ctx.bumps.config;
    Ok(())
}
