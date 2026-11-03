import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Supabase Migration Structure & Security Rules", () => {
  const migrationsDir = path.resolve(process.cwd(), "../../supabase/migrations");
  // In monorepo root or server directory
  const rootMigrationsDir = fs.existsSync(migrationsDir)
    ? migrationsDir
    : path.resolve(process.cwd(), "supabase/migrations");

  it("contains versioned create_profiles migration file", () => {
    const files = fs.readdirSync(rootMigrationsDir);
    const profileMigration = files.find((f) => f.includes("create_profiles.sql"));
    expect(profileMigration).toBeDefined();

    const content = fs.readFileSync(path.join(rootMigrationsDir, profileMigration!), "utf-8");

    // 1. Table structure
    expect(content).toContain("create table if not exists public.profiles");
    expect(content).toContain("references auth.users(id)");
    expect(content).toContain("on delete cascade");
    expect(content).toContain("display_name text not null");

    // 2. Constraints & indexes
    expect(content).toContain("constraint display_name_length check");
    expect(content).toContain("idx_profiles_display_name");

    // 3. Row Level Security
    expect(content).toContain("alter table public.profiles enable row level security;");
    expect(content).toContain('create policy "Users can read own profile"');
    expect(content).toContain('create policy "Users can update own profile"');
    expect(content).toContain('create policy "Users can insert own profile"');

    // 4. Verification that auth.uid() is used for ownership
    expect(content).toContain("auth.uid() = id");

    // 5. Triggers
    expect(content).toContain("handle_updated_at");
    expect(content).toContain("handle_new_user");
    expect(content).toContain("security definer set search_path = public");
  });
});
