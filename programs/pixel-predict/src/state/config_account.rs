use anchor_lang::prelude::*;

/// Singleton configuration PDA
/// PDA seeds: ["config"]
#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    /// Admin authority — can rotate oracle key and manage seasons
    pub admin: Pubkey,
    /// Oracle keypair pubkey — named `oracle` for Anchor `has_one` compatibility
    /// Admin can rotate this without program redeployment
    pub oracle: Pubkey,
    /// PDA bump seed
    pub bump: u8,
}
