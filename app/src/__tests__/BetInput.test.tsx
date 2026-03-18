import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BetInput } from "@/components/betting/BetInput";
import { MIN_BET_SOL, MAX_BET_SOL } from "@/lib/constants";

describe("BetInput", () => {
  it("renders input with initial value", () => {
    const onChange = vi.fn();
    render(<BetInput value={0.1} onChange={onChange} disabled={false} />);
    const input = screen.getByRole("textbox");
    expect((input as HTMLInputElement).value).toBe("0.1");
  });

  it("quick-set button '0.05' calls onChange with 0.05", () => {
    const onChange = vi.fn();
    render(<BetInput value={0.01} onChange={onChange} disabled={false} />);
    const btn = screen.getByRole("button", { name: /set bet to 0.05/i });
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(0.05);
  });

  it("'+' button increments value by 0.01 when value < 1", () => {
    const onChange = vi.fn();
    render(<BetInput value={0.05} onChange={onChange} disabled={false} />);
    const btn = screen.getByRole("button", { name: /increase bet/i });
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(0.06);
  });

  it("value does not go below MIN_BET_SOL (0.01) on '-' click", () => {
    const onChange = vi.fn();
    render(<BetInput value={MIN_BET_SOL} onChange={onChange} disabled={false} />);
    const btn = screen.getByRole("button", { name: /decrease bet/i });
    fireEvent.click(btn);
    // Should clamp to MIN_BET_SOL
    expect(onChange).toHaveBeenCalledWith(MIN_BET_SOL);
  });

  it("value does not exceed MAX_BET_SOL (10) on '+' click", () => {
    const onChange = vi.fn();
    render(<BetInput value={MAX_BET_SOL} onChange={onChange} disabled={false} />);
    const btn = screen.getByRole("button", { name: /increase bet/i });
    fireEvent.click(btn);
    // Should clamp to MAX_BET_SOL
    expect(onChange).toHaveBeenCalledWith(MAX_BET_SOL);
  });

  it("all inputs are disabled when disabled=true", () => {
    const onChange = vi.fn();
    render(<BetInput value={0.1} onChange={onChange} disabled={true} />);

    // Check the input field is disabled
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();

    // Check all buttons are disabled
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
