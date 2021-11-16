import type { Config } from "@jest/types";

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  transformIgnorePatterns: ["node_modules/(?!(y-protocols)/)"],
  //   transformIgnorePatterns: [],
  transform: {
    "\\.m?js$": "esm",
  },
};
export default config;
