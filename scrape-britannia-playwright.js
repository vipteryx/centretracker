const fs = require("fs");

const URL = "https://www.renfrewcc.com/facilities/swimming-pool/";
const DEFAULT_OUTPUT_PATH = "renfrew-pool.json";

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

function assertScrapeLooksValid({ pageTitle, h1Text }) {
  const title = normalizeText(pageTitle).toLowerCase();
  const heading = normalizeText(h1Text).toLowerCase();

  if (!heading) {
    throw new Error("No <h1> heading found on the page.");
  }

  const blocked = BLOCKLIST.some((item) => title.includes(item) || heading.includes(item));
  if (blocked) {
    throw new Error(
      `Scrape appears blocked (title: "${normalizeText(pageTitle)}", h1: "${normalizeText(h1Text)}").`,
    );
  }
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

async function scrape(url = URL, outputPath = DEFAULT_OUTPUT_PATH) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForSelector("body", { timeout: 30000 });

    const pageTitle = await page.title();
    const h1Text = (await page.locator("h1").first().textContent()) || "";

    assertScrapeLooksValid({ pageTitle, h1Text });

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
  DEFAULT_OUTPUT_PATH,
  URL,
  extractPageSummary,
  normalizeText,
  scrape,
};
