use anchor_lang::prelude::*;

#[error_code]
pub enum PixelPredictError {
    /// Oracle signature does not match config
    #[msg("Oracle signature does not match config")]
    UnauthorizedOracle,

    /// Admin signature does not match config
    #[msg("Admin signature does not match config")]
    UnauthorizedAdmin,

    /// Color must be 0-15
    #[msg("Color must be 0-15")]
    InvalidColor,

    /// Shade must be 0-100
    #[msg("Shade must be 0-100")]
    InvalidShade,

    /// Warmth must be 0-100
    #[msg("Warmth must be 0-100")]
    InvalidWarmth,

    /// Bet below minimum (0.01 SOL)
    #[msg("Bet below minimum (0.01 SOL)")]
    BetTooSmall,

    /// Bet exceeds maximum (10 SOL per color per pixel)
    #[msg("Bet exceeds maximum (10 SOL per color per pixel)")]
    BetTooLarge,

    /// Betting window has closed
    #[msg("Betting window has closed")]
    BettingLocked,

    /// Round is not in Open status
    #[msg("Round is not in Open status")]
    RoundNotOpen,

    /// Round is not in Locked status
    #[msg("Round is not in Locked status")]
    RoundNotLocked,

    /// Round is not in Resolved status
    #[msg("Round is not in Resolved status")]
    RoundNotResolved,

    /// Round has already been resolved
    #[msg("Round has already been resolved")]
    RoundAlreadyResolved,

    /// Cannot change bet color for this pixel
    #[msg("Cannot change bet color for this pixel")]
    ColorMismatch,

    /// Winnings already claimed
    #[msg("Winnings already claimed")]
    AlreadyClaimed,

    /// Bet color does not match winning color
    #[msg("Bet color does not match winning color")]
    NotWinner,

    /// Arithmetic overflow in calculation
    #[msg("Arithmetic overflow in calculation")]
    ArithmeticOverflow,

    /// Season is not in Active status
    #[msg("Season is not in Active status")]
    SeasonNotActive,

    /// Previous season not completed
    #[msg("Previous season not completed")]
    SeasonNotCompleted,

    /// Pixel index out of bounds
    #[msg("Pixel index out of bounds")]
    InvalidPixelIndex,

    /// 28-minute betting window has not elapsed
    #[msg("28-minute betting window has not elapsed")]
    LockoutNotReached,

    /// Insufficient lamports for payout
    #[msg("Insufficient lamports for payout")]
    InsufficientFunds,

    /// Previous pixel round must be resolved first
    #[msg("Previous pixel round must be resolved first")]
    PreviousRoundNotResolved,

    /// VRF randomness has not been fulfilled
    #[msg("VRF randomness has not been fulfilled")]
    VrfNotFulfilled,

    /// VRF account does not belong to expected VRF program
    #[msg("VRF account does not belong to expected VRF program")]
    InvalidVrfAccount,

    /// Treasury wallet address does not match the hardcoded constant
    #[msg("Treasury wallet address does not match the hardcoded constant")]
    InvalidTreasury,

    /// Jackpot wallet address does not match the hardcoded constant
    #[msg("Jackpot wallet address does not match the hardcoded constant")]
    InvalidJackpot,
}
