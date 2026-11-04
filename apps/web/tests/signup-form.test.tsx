import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignupForm } from "../src/components/auth/SignupForm";

const mockPush = vi.fn();
const mockSignUp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

describe("SignupForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all registration fields and submit button", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Display Name")).toBeDefined();
    expect(screen.getByLabelText("Email Address")).toBeDefined();
    expect(screen.getByLabelText("Password", { selector: "input" })).toBeDefined();
    expect(screen.getByLabelText("Confirm Password", { selector: "input" })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Create Account$/i })).toBeDefined();
  });

  it("validates display name length boundaries (2 to 50 characters)", async () => {
    render(<SignupForm />);

    // 1 character name
    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "a" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "user@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password", { selector: "input" }), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Account$/i }));

    expect(
      await screen.findByText(/Display name must be between 2 and 50 characters/i)
    ).toBeDefined();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("validates password matching constraint", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Shadow" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "user@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password", { selector: "input" }), {
      target: { value: "different-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Account$/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeDefined();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("submits valid registration and displays email verification instructions", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-123", email: "runner@irlg.gg" }, session: null },
      error: null,
    });

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "ApexPredator" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "runner@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "supersecret123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password", { selector: "input" }), {
      target: { value: "supersecret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Account$/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "runner@irlg.gg",
        password: "supersecret123",
        options: expect.objectContaining({
          data: {
            display_name: "ApexPredator",
          },
        }),
      });
    });

    // Verification confirmation screen
    expect(await screen.findByText(/Verify Your Email/i)).toBeDefined();
    expect(screen.getByText("runner@irlg.gg")).toBeDefined();
  });

  it("displays server error alert on signup failure", async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "ApexPredator" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "existing@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "supersecret123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password", { selector: "input" }), {
      target: { value: "supersecret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Account$/i }));

    expect(await screen.findByText("User already registered")).toBeDefined();
  });
});
