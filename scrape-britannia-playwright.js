const fs = require("fs");

const TARGET_URL = "https://www.renfrewcc.com/facilities/swimming-pool/";
const DEFAULT_OUTPUT_PATH = "britannia-hours.json";

// Keywords that indicate a bot-detection wall rather than real content
const BLOCKLIST = ["attention required", "sorry, you have been blocked", "cloudflare"];

// Matches times like "6:00 AM", "10am", "9:30 PM"
const TIME_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

// Realistic desktop user agents to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function normalizeText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Build the JSON record that gets written to disk.
 */
function buildRecord({ pageTitle, h1Text, scheduleItems, rawContent }) {
  return {
    lastUpdated: new Date().toISOString(),
    url: TARGET_URL,
    pageTitle: normalizeText(pageTitle),
    primaryHeading: normalizeText(h1Text),
    scheduleItems,
    // Capture a snippet of the main body text (capped for readability)
    rawContent: rawContent ? normalizeText(rawContent).slice(0, 3000) : null,
  };
}

/**
 * Throw if the page looks like a bot-detection wall instead of real content.
 */
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

/**
 * Load playwright-extra with the stealth plugin when available,
 * falling back gracefully to standard playwright / playwright-core.
 */
async function loadChromium() {
  try {
    const { chromium } = require("playwright-extra");
    const stealth = require("puppeteer-extra-plugin-stealth")();
    chromium.use(stealth);
    console.log("Using playwright-extra with stealth plugin.");
    return chromium;
  } catch (_stealthErr) {
    // Stealth not available – use vanilla playwright
  }

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

/**
 * Pull schedule-related rows and list items out of the page DOM.
 * Returns an array of plain-text strings, each representing one schedule entry.
 */
async function extractScheduleItems(page) {
  return page.evaluate((timePatternSrc) => {
    const re = new RegExp(timePatternSrc, "i");
    const results = [];

    // 1. Table rows that contain at least one time value
    for (const table of document.querySelectorAll("table")) {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td, th")].map((c) =>
          c.textContent.replace(/\s+/g, " ").trim(),
        );
        if (cells.some((c) => re.test(c))) {
          results.push(cells.filter(Boolean).join(" | "));
        }
      }
    }

    // 2. Leaf elements (<li>, <p>, <span>, <div>) that mention a time
    if (results.length === 0) {
      for (const el of document.querySelectorAll("li, p, span, div")) {
        if (el.children.length > 0) continue; // skip non-leaf nodes
        const text = el.textContent.replace(/\s+/g, " ").trim();
        if (re.test(text) && text.length < 300) {
          results.push(text);
        }
      }
    }

    // Deduplicate while preserving order
    return [...new Set(results)].slice(0, 60);
  }, TIME_PATTERN.source);
}

/**
 * Extract the most relevant block of body text from the page.
 * Tries semantic landmarks first, falls back to <body>.
 */
async function extractRawContent(page) {
  return page.evaluate(() => {
    const candidate = document.querySelector(
      "main, article, [role='main'], .content, #content, .entry-content, .page-content",
    );
    const el = candidate || document.body;
    return el.innerText;
  });
}

/**
 * One attempt at scraping the target page.
 */
async function scrapeOnce(url, outputPath) {
  const chromium = await loadChromium();

  const userAgent = USER_AGENTS[randomBetween(0, USER_AGENTS.length - 1)];
  const viewport = {
    width: randomBetween(1280, 1920),
    height: randomBetween(720, 1080),
  };

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent,
      viewport,
      locale: "en-CA",
      timezoneId: "America/Vancouver",
      // Accept common web languages to look like a real browser
      extraHTTPHeaders: {
        "Accept-Language": "en-CA,en-GB;q=0.9,en;q=0.8",
      },
    });

    const page = await context.newPage();

    // Small random pre-navigation pause – mimics human thinking time
    await sleep(randomBetween(500, 1500));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    try {
      await page.waitForSelector("h1", { timeout: 30000 });
    } catch {
      // h1 absent (e.g. Cloudflare JS challenge); assertScrapeLooksValid handles it
    }

    const pageTitle = await page.title();
    const headingLocator = page.locator("h1").first();
    const hasHeading = (await headingLocator.count()) > 0;
    const h1Text = hasHeading ? (await headingLocator.textContent()) || "" : "";

    assertScrapeLooksValid({ pageTitle, h1Text });

    const scheduleItems = await extractScheduleItems(page);
    const rawContent = await extractRawContent(page);

    const record = buildRecord({ pageTitle, h1Text, scheduleItems, rawContent });
    fs.writeFileSync(outputPath, JSON.stringify(record, null, 2));
    console.log(`Saved ${outputPath} — ${scheduleItems.length} schedule item(s) found.`);

    return record;
  } finally {
    await browser.close();
  }
}

/**
 * Retry wrapper with exponential back-off.
 * Attempt 1 → immediate
 * Attempt 2 → wait 2 s
 * Attempt 3 → wait 4 s
 */
async function scrape(url = TARGET_URL, outputPath = DEFAULT_OUTPUT_PATH, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Scrape attempt ${attempt}/${maxRetries}…`);
      return await scrapeOnce(url, outputPath);
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2 s, 4 s, …
        console.log(`Retrying in ${delay / 1000} s…`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  scrape().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  BLOCKLIST,
  DEFAULT_OUTPUT_PATH,
  TARGET_URL,
  // keep old alias so any callers using URL still work
  URL: TARGET_URL,
  assertScrapeLooksValid,
  buildRecord,
  // keep old alias
  extractPageSummary: buildRecord,
  normalizeText,
  scrape,
};
