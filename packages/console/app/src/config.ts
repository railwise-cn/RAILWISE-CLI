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
      compact: "160K",
      full: "160,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/railwise",
    discord: "https://discord.gg/railwise",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "900",
    commits: "13,000",
    monthlyUsers: "7.5M",
  },
} as const
