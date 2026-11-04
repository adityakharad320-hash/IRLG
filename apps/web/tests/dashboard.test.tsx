import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardHeader } from "../src/components/dashboard/DashboardHeader";
import { ProfileEditor } from "../src/components/dashboard/ProfileEditor";

const mockSignOut = vi.fn();
const mockRefreshProfile = vi.fn();
const mockUpdateCurrentUserProfile = vi.fn();

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      email: "operator1@irlg.gg",
      user_metadata: { display_name: "ShadowRunner" },
    },
    session: { access_token: "mock-access-token" },
    profile: {
      id: "11111111-1111-1111-1111-111111111111",
      displayName: "ShadowRunner",
      avatarUrl: "https://irlg.gg/avatar.png",
      createdAt: "2026-11-04T00:00:00Z",
      updatedAt: "2026-11-04T00:00:00Z",
    },
    isLoading: false,
    isProfileLoading: false,
    profileError: null,
    refreshProfile: mockRefreshProfile,
    signOut: mockSignOut,
  }),
}));

vi.mock("../src/lib/api/users", () => ({
  updateCurrentUserProfile: (...args: unknown[]) => mockUpdateCurrentUserProfile(...args),
}));

describe("Dashboard Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DashboardHeader", () => {
    it("renders user information and triggers signOut on logout click", () => {
      render(<DashboardHeader />);

      expect(screen.getByText("ShadowRunner")).toBeDefined();
      expect(screen.getByText("operator1@irlg.gg")).toBeDefined();

      const logoutBtn = screen.getByRole("button", { name: /Log Out/i });
      fireEvent.click(logoutBtn);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("ProfileEditor", () => {
    it("displays user account overview details", () => {
      render(<ProfileEditor />);

      expect(screen.getByText("operator1@irlg.gg")).toBeDefined();
      expect(screen.getByText("11111111-1111-1111-1111-111111111111")).toBeDefined();
      expect(screen.getByText("Backend Connected")).toBeDefined();
    });

    it("validates display name and avatar URL fields on edit", async () => {
      render(<ProfileEditor />);

      const nameInput = screen.getByLabelText(/Display Name/i);
      const avatarInput = screen.getByLabelText(/Avatar URL/i);
      const saveBtn = screen.getByRole("button", { name: /Save Changes/i });

      // Test empty name
      fireEvent.change(nameInput, { target: { value: "" } });
      fireEvent.click(saveBtn);
      expect(await screen.findByText(/Display name cannot be empty/i)).toBeDefined();
      expect(mockUpdateCurrentUserProfile).not.toHaveBeenCalled();

      // Test invalid URL
      fireEvent.change(nameInput, { target: { value: "NewAlias" } });
      fireEvent.change(avatarInput, { target: { value: "not-a-url" } });
      fireEvent.click(saveBtn);
      expect(await screen.findByText(/Avatar URL must be a valid URL/i)).toBeDefined();
      expect(mockUpdateCurrentUserProfile).not.toHaveBeenCalled();
    });

    it("submits valid profile update and triggers profile refresh", async () => {
      mockUpdateCurrentUserProfile.mockResolvedValue({
        id: "11111111-1111-1111-1111-111111111111",
        displayName: "CyberGhost",
        avatarUrl: "https://irlg.gg/new-avatar.png",
        createdAt: "2026-11-04T00:00:00Z",
        updatedAt: "2026-11-04T01:00:00Z",
      });

      render(<ProfileEditor />);

      const nameInput = screen.getByLabelText(/Display Name/i);
      const avatarInput = screen.getByLabelText(/Avatar URL/i);
      const saveBtn = screen.getByRole("button", { name: /Save Changes/i });

      fireEvent.change(nameInput, { target: { value: "CyberGhost" } });
      fireEvent.change(avatarInput, { target: { value: "https://irlg.gg/new-avatar.png" } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateCurrentUserProfile).toHaveBeenCalledWith(
          "mock-access-token",
          {
            displayName: "CyberGhost",
            avatarUrl: "https://irlg.gg/new-avatar.png",
          }
        );
        expect(mockRefreshProfile).toHaveBeenCalled();
      });

      expect(await screen.findByText(/Profile updated successfully!/i)).toBeDefined();
    });
  });
});
