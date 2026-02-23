const { scrape } = require("./scrape-britannia-playwright");

const URL = "https://britanniacentre.org/pool/";
const DEFAULT_OUTPUT_PATH = "britanniacentre-pool-hours.json";

if (require.main === module) {
  scrape(URL, DEFAULT_OUTPUT_PATH).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { URL, DEFAULT_OUTPUT_PATH };
