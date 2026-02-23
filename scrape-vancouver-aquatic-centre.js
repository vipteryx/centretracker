const { scrape } = require("./scrape-britannia-playwright");

const URL = "https://vancouver.ca/parks-recreation-culture/vancouver-aquatic-centre.aspx";
const DEFAULT_OUTPUT_PATH = "vancouver-aquatic-centre-hours.json";

if (require.main === module) {
  scrape(URL, DEFAULT_OUTPUT_PATH).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { URL, DEFAULT_OUTPUT_PATH };
