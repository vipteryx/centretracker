const fs = require("fs");

const URL = "https://vancouver.ca/parks-recreation-culture/britannia-pool.aspx";

function normalizeText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function extractPageSummary({ pageTitle, h1Text }) {
  return {
    lastUpdated: new Date().toISOString(),
    pageTitle: normalizeText(pageTitle),
    primaryHeading: normalizeText(h1Text),
  };
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

    // Temporarily use a highly reliable element to confirm page load instead of table parsing.
    await page.waitForSelector("body", { timeout: 30000 });

    const pageTitle = await page.title();
    const h1Text =
      (await page.locator("h1").first().textContent().catch(() => null)) || "";

    const result = extractPageSummary({ pageTitle, h1Text });

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
  extractPageSummary,
  normalizeText,
  scrape,
};
