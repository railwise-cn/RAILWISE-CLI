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
      compact: "140K",
      full: "140,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/railwise",
    discord: "https://discord.gg/railwise",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "850",
    commits: "11,000",
    monthlyUsers: "6.5M",
  },
} as const
