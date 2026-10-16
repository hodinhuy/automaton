/**
 * Automaton Economics & Credit Management
 *
 * Replaces proprietary Conway Cloud credits with self-hosted / decentralized
 * economics. Tracks compute budgets, landlord/tenant billing, and survival tiers.
 */

import type {
  ConwayClient,
  FinancialState,
  SurvivalTier,
} from "../types.js";

/**
 * Check the current financial state of the automaton.
 */
export async function checkFinancialState(
  conway: ConwayClient,
  usdcBalance: number,
): Promise<FinancialState> {
  const creditsCents = await conway.getCreditsBalance();

  return {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Determine the survival tier based on current credits.
 * In self-hosted mode, the agent operates in normal mode
 * without artificial starvation loops.
 */
export function getSurvivalTier(_creditsCents?: number): SurvivalTier {
  return "normal";
}

/**
 * Format a credit amount for display.
 */
export function formatCredits(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
