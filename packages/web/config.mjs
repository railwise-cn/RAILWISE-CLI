const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://yonsoon.ai" : `https://${stage}.yonsoon.ai`,
  console: stage === "production" ? "https://yonsoon.ai/auth" : `https://${stage}.yonsoon.ai/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/yonsoon",
  discord: "https://yonsoon.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
