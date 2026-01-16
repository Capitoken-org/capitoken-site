export const PROJECT = {
  name: "Capitoken",
  chain: "Ethereum Mainnet",
  officialDomain: "capitoken-org.github.io/capitoken-site/",
  verifyUrl: "https://capitoken-org.github.io/capitoken-site/verify",
};

export const TOKEN = {
  symbol: "CAPI",
  // Pega aquí el contrato cuando esté listo (0x...)
  address: "TBA",
  decimals: 18,

  // Uniswap v2 pair (si aplica) o pool address (si v3)
  pairOrPoolAddress: "TBA",

  // Links oficiales (por ahora TBA)
  links: {
    website: "https://capitoken-org.github.io/capitoken-site/",
    x: "TBA",
    telegram: "TBA",
    github: "https://github.com/Capitoken-org",
  },
};

// Helpers
export function isAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function tokenReady() {
  return isAddress(TOKEN.address);
}
