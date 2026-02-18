const fs = require("fs");
const cheerio = require("cheerio");

const URL = "https://vancouver.ca/parks-recreation-culture/britannia-pool.aspx";

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseTable($, table) {
  const rows = $(table).find("tr").toArray();
  if (rows.length < 2) {
    return {};
  }

  const headers = $(rows[0])
    .find("th,td")
    .toArray()
    .map((cell) => normalizeText($(cell).text()));

  const data = {};

  rows.slice(1).forEach((row) => {
    $(row)
      .find("td")
      .toArray()
      .forEach((cell, index) => {
        const key = headers[index];
        if (!key) {
          return;
        }

        const listItems = $(cell)
          .find("li")
          .toArray()
          .map((li) => normalizeText($(li).text()))
          .filter(Boolean);

        if (listItems.length) {
          data[key] = listItems;
          return;
        }

        const text = normalizeText($(cell).text());
        if (text) {
          data[key] = text;
        }
      });
  });

  return data;
}

function extractHoursFromHtml(html) {
  const $ = cheerio.load(html);

  const result = {
    lastUpdated: new Date().toISOString(),
    fitnessCentreHours: {},
    poolHours: {},
  };

  $("h2, h3, h4").each((_, el) => {
    const heading = normalizeText($(el).text()).toLowerCase();
    const table = $(el).nextAll("table").first();

    if (!table.length) {
      return;
    }

    if (heading.includes("fitness centre hours")) {
      result.fitnessCentreHours = parseTable($, table);
    }

    if (heading.includes("pool hours and schedule")) {
      result.poolHours = parseTable($, table);
    }
  });

  return result;
}

async function loadChromium() {
  try {
    return require("playwright").chromium;
  } catch (playwrightErr) {
    try {
      return require("playwright-core").chromium;
    } catch (coreErr) {
      const err = new Error(
        "Playwright is not installed. Install `playwright` (or `playwright-core`) before running this scraper.",
      );
      err.cause = { playwrightErr, coreErr };
      throw err;
    }
  }
}

async function scrape(url = URL, outputPath = "britannia-hours.json") {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("table", { timeout: 30000 });

    const html = await page.content();
    const result = extractHoursFromHtml(html);

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Updated ${outputPath}`);

    return result;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  scrape().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  extractHoursFromHtml,
  normalizeText,
  parseTable,
  scrape,
};
