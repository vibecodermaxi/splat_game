use anchor_lang::prelude::*;
use crate::errors::PixelPredictError;

/// Calculates a winner's payout using u128 intermediates and multiply-before-divide.
/// net_pool = total_pool * 95 / 100 (rake already transferred separately)
/// payout = bet_amount * net_pool / winning_color_pool
pub fn calculate_winner_payout(
    bet_amount: u64,
    winning_color_pool: u64,
    total_pool: u64,
) -> Result<u64> {
    let net_pool = (total_pool as u128)
        .checked_mul(95)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?
        .checked_div(100)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

    let payout = (bet_amount as u128)
        .checked_mul(net_pool)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?
        .checked_div(winning_color_pool as u128)
        .ok_or(error!(PixelPredictError::ArithmeticOverflow))?;

    u64::try_from(payout).map_err(|_| error!(PixelPredictError::ArithmeticOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// SC-12-MATH: Sole winner gets 95% of pool (5% rake)
    #[test]
    fn test_sole_winner_gets_95_percent() {
        // bet_amount == winning_color_pool == total_pool (sole winner)
        let result = calculate_winner_payout(10_000_000, 10_000_000, 10_000_000).unwrap();
        assert_eq!(result, 9_500_000, "Sole winner should receive 95% = 9_500_000");
    }

    /// SC-12-PROPORTIONAL: Two winners share pool proportionally
    #[test]
    fn test_proportional_split() {
        // Player bet 5_000_000, winning_color_pool = 10_000_000 (50% share), total_pool = 20_000_000
        // net_pool = 20_000_000 * 95 / 100 = 19_000_000
        // payout = 5_000_000 * 19_000_000 / 10_000_000 = 9_500_000
        let result = calculate_winner_payout(5_000_000, 10_000_000, 20_000_000).unwrap();
        assert_eq!(result, 9_500_000, "Half of winning pool should receive 9_500_000");
    }

    /// SC-12-U128: Small bet against large pool uses u128 and does not truncate to 0
    #[test]
    fn test_small_bet_large_pool_no_overflow() {
        // bet_amount = 10_000_000, winning_color_pool = 50_000_000_000, total_pool = 100_000_000_000
        // net_pool = 100_000_000_000 * 95 / 100 = 95_000_000_000
        // payout = 10_000_000 * 95_000_000_000 / 50_000_000_000 = 19_000_000
        let result = calculate_winner_payout(10_000_000, 50_000_000_000, 100_000_000_000).unwrap();
        assert_eq!(result, 19_000_000, "Small bet against large pool should not truncate to 0");
    }

    /// Zero color_pool returns error (div by zero prevented)
    #[test]
    fn test_zero_winning_pool_returns_error() {
        let result = calculate_winner_payout(10_000_000, 0, 10_000_000);
        assert!(result.is_err(), "Zero winning_color_pool should return error");
    }
}
