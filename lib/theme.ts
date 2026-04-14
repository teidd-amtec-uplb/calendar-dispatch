// Role-based theme configuration
// Default = Navy/Gold (admin_scheduler, staff, etc.)
// AMaTS = Maroon/Rose

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  sidebarFrom: string;
  sidebarTo: string;
};

const DEFAULT_THEME: ThemeColors = {
  primary: "#1B2A6B",
  primaryDark: "#0F1A4A",
  primaryLight: "#EEF1FB",
  accent: "#F5A623",
  accentLight: "rgba(245,166,35,0.15)",
  sidebarFrom: "#0F1A4A",
  sidebarTo: "#1B2A6B",
};

const AMaTS_THEME: ThemeColors = {
  primary: "#7B1F2F",
  primaryDark: "#5A1020",
  primaryLight: "#FBEEF0",
  accent: "#D4A574",
  accentLight: "rgba(212,165,116,0.15)",
  sidebarFrom: "#4A0E1A",
  sidebarTo: "#7B1F2F",
};

export function getThemeForRole(role: string): ThemeColors {
  if (role === "AMaTS") return AMaTS_THEME;
  return DEFAULT_THEME;
}

// Generates inline CSS variable declarations for a given theme
export function themeVars(theme: ThemeColors): Record<string, string> {
  return {
    "--theme-primary": theme.primary,
    "--theme-primary-dark": theme.primaryDark,
    "--theme-primary-light": theme.primaryLight,
    "--theme-accent": theme.accent,
    "--theme-accent-light": theme.accentLight,
    "--theme-sidebar-from": theme.sidebarFrom,
    "--theme-sidebar-to": theme.sidebarTo,
  };
}
