import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../src/components/auth/LoginForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

describe("LoginForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email, password inputs, submit button and links", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email Address")).toBeDefined();
    expect(screen.getByLabelText("Password", { selector: "input" })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Sign In$/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Create account/i })).toBeDefined();
  });

  it("validates required email and password fields on submit", async () => {
    render(<LoginForm />);

    const submitBtn = screen.getByRole("button", { name: /^Sign In$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Email is required/i)).toBeDefined();
    expect(await screen.findByText(/Password is required/i)).toBeDefined();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("validates invalid email format", async () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "invalid-email-address" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(await screen.findByText(/Please enter a valid email address/i)).toBeDefined();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password", { selector: "input" }) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: /Show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(passwordInput.type).toBe("password");
  });

  it("submits valid credentials and redirects to dashboard", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: "jwt-token" }, user: { id: "user-1" } },
      error: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "player@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "player@irlg.gg",
        password: "password123",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("displays server error alert on invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "player@irlg.gg" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
