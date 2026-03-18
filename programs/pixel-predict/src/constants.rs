use anchor_lang::prelude::Pubkey;

/// Minimum bet amount: 0.01 SOL in lamports
pub const MIN_BET: u64 = 10_000_000;

/// Maximum bet per color per pixel: 10 SOL in lamports
pub const MAX_BET_PER_COLOR: u64 = 10_000_000_000;

/// Number of betting colors available
pub const NUM_COLORS: u8 = 16;

/// Total rake in basis points: 5%
pub const RAKE_BPS: u16 = 500;

/// Treasury wallet share in basis points: 3%
pub const TREASURY_BPS: u16 = 300;

/// Jackpot wallet share in basis points: 2%
pub const JACKPOT_BPS: u16 = 200;

/// Betting window duration in seconds: 28 minutes
pub const BETTING_WINDOW_SECONDS: i64 = 1680;

/// Total round duration in seconds: 30 minutes
pub const ROUND_DURATION_SECONDS: i64 = 1800;

/// Treasury wallet address — hardcoded, NOT admin-redirectable even if admin key is compromised
/// Devnet treasury wallet
pub const TREASURY_WALLET: Pubkey = anchor_lang::pubkey!("6vTe3xRjB4Hv4fN4WQ5xtcF21Ed12DFPoNwHJTZDUg5v");

/// Jackpot wallet address — hardcoded, NOT admin-redirectable even if admin key is compromised
/// Devnet jackpot wallet
pub const JACKPOT_WALLET: Pubkey = anchor_lang::pubkey!("HrfnbCNRzvekRkdUJGzvmEu478F43uk7weReNDPqv2TB");

/// Switchboard On-Demand (v3) randomness program ID.
/// Randomness accounts passed to resolve_round_vrf must be owned by this program.
/// This is the production Switchboard On-Demand randomness program on mainnet and devnet.
pub const SWITCHBOARD_RANDOMNESS_PROGRAM: Pubkey = anchor_lang::pubkey!("RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh");

/// Switchboard On-Demand Randomness account discriminator.
/// sha256("account:RandomnessAccountData")[0..8]
/// Used to validate that the account is a genuine Switchboard randomness account.
pub const SWITCHBOARD_RANDOMNESS_DISCRIMINATOR: [u8; 8] = [42, 196, 232, 166, 126, 135, 235, 168];

/// Byte offset for the `value` field in Switchboard Randomness accounts:
///   8  (discriminator)
/// + 32 (queue: Pubkey)
/// + 32 (seed: [u8; 32])
/// + 8  (expiration_slot: u64)
/// = 80
/// The value field holds 64 bytes of random data.
/// All-zero = pending (not yet fulfilled), non-zero = fulfilled.
pub const SWITCHBOARD_RANDOMNESS_VALUE_OFFSET: usize = 80;
