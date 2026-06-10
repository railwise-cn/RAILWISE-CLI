/**
 * Application-wide constants and configuration
 */
export const config = {
  // Base URL
  baseUrl: "https://railwise.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/anomalyco/railwise",
    starsFormatted: {
      compact: "120K",
      full: "120,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/railwise",
    discord: "https://discord.gg/railwise",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "800",
    commits: "10,000",
    monthlyUsers: "5M",
  },
} as const
