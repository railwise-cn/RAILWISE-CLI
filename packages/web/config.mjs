const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://railwise.ai" : `https://${stage}.railwise.ai`,
  console: stage === "production" ? "https://railwise.ai/auth" : `https://${stage}.railwise.ai/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/railwise",
  discord: "https://railwise.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
