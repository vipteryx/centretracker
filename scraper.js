const fs = require("fs");

const URL =
  "https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2";
const DEFAULT_OUTPUT_PATH = "page-summary.json";
const DEFAULT_POOL_TIMES_PATH = "pool-times.json";
const BLOCKLIST = ["attention required", "sorry, you have been blocked", "cloudflare"];

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

// Converts "Feb 23" / "February 23" / "02/23" to "YYYY-MM-DD" using referenceYear.
// Handles year-rollover edge cases near Dec/Jan boundaries.
function parseMonthDay(str, referenceYear) {
  if (!str) return null;
  const MONTHS = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const abbrevMatch = str.match(/([a-z]{3})[a-z.]*\s+(\d{1,2})/i);
  if (abbrevMatch) {
    const month = MONTHS[abbrevMatch[1].toLowerCase()];
    if (!month) return null;
    const day = abbrevMatch[2].padStart(2, "0");
    let year = referenceYear;
    const parsedMonthIndex = parseInt(month, 10) - 1;
    const currentMonthIndex = new Date().getMonth();
    if (parsedMonthIndex === 0 && currentMonthIndex >= 10) year++;
    if (parsedMonthIndex >= 10 && currentMonthIndex <= 1) year--;
    return `${year}-${month}-${day}`;
  }
  const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    let year = referenceYear;
    const parsedMonthIndex = parseInt(slashMatch[1], 10) - 1;
    const currentMonthIndex = new Date().getMonth();
    if (parsedMonthIndex === 0 && currentMonthIndex >= 10) year++;
    if (parsedMonthIndex >= 10 && currentMonthIndex <= 1) year--;
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Assembles the final pool-times output object.
function buildPoolTimesResult(days, weekRange) {
  return {
    lastUpdated: new Date().toISOString(),
    weekRange,
    days,
  };
}

// Recursively searches obj for an array of objects that look like calendar sessions.
// Checks for any combination of name-like and time/date-like keys. Depth-limited.
function findSessionArray(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 6 || obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      const keys = Object.keys(obj[0]).map((k) => k.toLowerCase());
      const hasTime = keys.some((k) => /time|date|start|end|when/.test(k));
      const hasName = keys.some((k) => /name|title|desc|activ|event/.test(k));
      if (hasTime && hasName) return obj;
    }
    for (const item of obj) {
      const found = findSessionArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  for (const val of Object.values(obj)) {
    const found = findSessionArray(val, depth + 1);
    if (found) return found;
  }
  return null;
}

// Attempts to find an array of session-like objects anywhere in a captured API response body.
function parseApiResponseForSessions(jsonBody) {
  return findSessionArray(jsonBody, 0);
}

// Formats an ISO datetime string or raw time string to "10:00am" style.
function formatTimeValue(raw) {
  if (!raw) return "";
  const isoMatch = String(raw).match(/T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1], 10);
    const mins = isoMatch[2];
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins}${ampm}`;
  }
  return normalizeText(String(raw));
}

// Maps raw API session objects to the canonical output schema.
function normalizeSessions(rawSessions) {
  return rawSessions.map((s) => {
    const session = {
      name: normalizeText(
        s.activity_name || s.activityName || s.name || s.title || s.description || ""
      ),
    };
    const startRaw = s.start_time || s.startTime || s.time || "";
    const endRaw = s.end_time || s.endTime || "";
    if (startRaw && endRaw) {
      session.time = `${formatTimeValue(startRaw)} - ${formatTimeValue(endRaw)}`;
    } else if (startRaw) {
      session.time = formatTimeValue(startRaw);
    }
    const loc = normalizeText(
      s.location || s.locationName || s.location_name ||
      s.facility_name || s.facilityName || s.room || ""
    );
    if (loc) session.location = loc;
    const status = normalizeText(s.status || s.availability || "");
    if (status) session.status = status;
    return session;
  });
}

// Groups a flat array of raw API session objects by day, returns sorted days array.
function groupApiSessionsByDay(rawSessions, referenceYear) {
  const dayMap = new Map();
  for (const s of rawSessions) {
    const rawDate =
      s.date || s.session_date || s.start_date || s.startDate ||
      s.activity_date || s.day || "";
    let isoDate = null;
    if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      isoDate = rawDate.slice(0, 10);
    } else if (rawDate) {
      isoDate = parseMonthDay(String(rawDate), referenceYear);
    }
    const key = isoDate || "unknown";
    if (!dayMap.has(key)) {
      const dayOfWeek = isoDate
        ? new Date(isoDate).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
        : "";
      dayMap.set(key, { date: isoDate || String(rawDate), dayOfWeek, sessions: [] });
    }
    dayMap.get(key).sessions.push(...normalizeSessions([s]));
  }
  return Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    try {
      await page.waitForSelector("h1", { timeout: 30000 });
    } catch {
      // h1 may be absent (e.g. Cloudflare JS challenge); assertScrapeLooksValid will handle it
    }

    const pageTitle = await page.title();
    const headingLocator = page.locator("h1").first();
    const hasHeading = (await headingLocator.count()) > 0;
    const h1Text = hasHeading ? (await headingLocator.textContent()) || "" : "";

    assertScrapeLooksValid({ pageTitle, h1Text });

    const result = extractPageSummary({ pageTitle, h1Text });

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Updated ${outputPath}`);

    return result;
  } finally {
    await browser.close();
  }
}

async function extractPoolTimes(url = URL, outputPath = DEFAULT_POOL_TIMES_PATH) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    try {
      await page.waitForSelector("h1", { timeout: 15000 });
    } catch {
      // h1 may be absent; assertScrapeLooksValid handles it
    }

    const pageTitle = await page.title();
    const headingLocator = page.locator("h1").first();
    const hasHeading = (await headingLocator.count()) > 0;
    const h1Text = hasHeading ? (await headingLocator.textContent()) || "" : "";

    assertScrapeLooksValid({ pageTitle, h1Text });

    const referenceYear = new Date().getFullYear();
    let days = [];

    // --- Primary: scan <script> tags for embedded JSON containing session data ---
    // SPAs commonly embed initial state in inline scripts (window.__STATE__, window.DATA, etc.)
    // rather than making separate JSON API requests.
    const scriptJsonCandidates = await page.evaluate(() => {
      const results = [];
      for (const script of Array.from(document.querySelectorAll("script:not([src])"))) {
        const text = script.textContent || "";
        // Find all JSON-like blobs: anything starting with { or [ that is large enough
        // to plausibly contain calendar data (>100 chars).
        const matches = text.match(/(?:=\s*|:\s*)(\[[\s\S]{100,})/g);
        if (!matches) continue;
        for (const m of matches) {
          // Strip the leading assignment/colon, try to parse the JSON blob.
          const raw = m.replace(/^[=:]\s*/, "");
          // Take only the outermost array (stop at balanced bracket).
          let depth = 0;
          let end = 0;
          for (let i = 0; i < raw.length; i++) {
            if (raw[i] === "[" || raw[i] === "{") depth++;
            else if (raw[i] === "]" || raw[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
          }
          const slice = raw.slice(0, end);
          try {
            const parsed = JSON.parse(slice);
            results.push(parsed);
          } catch {
            // not valid JSON; skip
          }
        }
      }
      return results;
    });

    for (const candidate of scriptJsonCandidates) {
      const rawSessions = parseApiResponseForSessions(candidate);
      if (rawSessions) {
        console.log("Using session data from embedded <script> JSON blob.");
        days = groupApiSessionsByDay(rawSessions, referenceYear);
        break;
      }
    }

    // --- Fallback: broad DOM scan for activity/session elements ---
    // Tries multiple selector patterns without assuming Shadow DOM or specific library classes.
    if (days.length === 0) {
      console.log("No session data found in <script> tags; falling back to DOM scan.");

      const rawDays = await page.evaluate(() => {
        const TIME_RE = /\d{1,2}:\d{2}\s*(?:AM|PM)/i;
        const DATE_RE = /\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/i;

        // Collect elements that carry a date attribute or whose aria-label / text
        // contains a date-like string, and also contain time-like text.
        const dayMap = {};

        // Strategy 1: elements with data-date attribute (FullCalendar, custom widgets)
        for (const el of Array.from(document.querySelectorAll("[data-date]"))) {
          const date = el.getAttribute("data-date");
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          const eventEls = el.querySelectorAll("[class*='event'], [class*='session'], [class*='activity'], [role='button'], li, .item");
          for (const ev of Array.from(eventEls)) {
            const text = (ev.textContent || "").replace(/\s+/g, " ").trim();
            if (!TIME_RE.test(text)) continue;
            if (!dayMap[date]) dayMap[date] = [];
            dayMap[date].push(text);
          }
        }

        // Strategy 2: aria-labelled event elements anywhere in the page
        const ariaEls = document.querySelectorAll("[aria-label]");
        for (const el of Array.from(ariaEls)) {
          const label = el.getAttribute("aria-label") || "";
          const dateMatch = label.match(/(\d{4}-\d{2}-\d{2})|(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}))/i);
          if (!dateMatch || !TIME_RE.test(label)) continue;
          // Use ISO date directly or reconstruct from month/day/year groups
          const date = dateMatch[1] || (() => {
            const MONTHS = {Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"};
            const mon = MONTHS[dateMatch[2].slice(0,3)] || "00";
            const day = (dateMatch[3] || "1").padStart(2, "0");
            return `${dateMatch[4]}-${mon}-${day}`;
          })();
          if (!dayMap[date]) dayMap[date] = [];
          dayMap[date].push(label.trim());
        }

        // Strategy 3: table rows that contain both a date-like and time-like string
        for (const row of Array.from(document.querySelectorAll("tr"))) {
          const text = (row.textContent || "").replace(/\s+/g, " ").trim();
          const dateM = text.match(DATE_RE);
          if (!dateM || !TIME_RE.test(text)) continue;
          // Use the matched date string as the key (will be normalised later)
          const key = dateM[0];
          if (!dayMap[key]) dayMap[key] = [];
          dayMap[key].push(text);
        }

        return dayMap;
      });

      // Convert the raw dayMap into the canonical days structure.
      for (const [rawDate, texts] of Object.entries(rawDays)) {
        if (!texts.length) continue;
        const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
          ? rawDate
          : null; // non-ISO keys (from table rows) — skip for now; debug HTML will clarify
        if (!isoDate) continue;
        const dayOfWeek = new Date(isoDate).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        const sessions = texts.map((t) => ({ name: normalizeText(t), time: "" }));
        days.push({ date: isoDate, dayOfWeek, sessions });
      }
      days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }

    // Always save rendered HTML so every run leaves an inspectable artefact.
    const debugHtml = await page.content();
    fs.writeFileSync("debug-page.html", debugHtml);
    if (days.length === 0) {
      console.warn("Extraction yielded no sessions. Inspect debug-page.html for details.");
    } else {
      console.log(`Extracted ${days.length} day(s). Saved rendered HTML to debug-page.html.`);
    }

    const sortedDates = days
      .map((d) => d.date)
      .filter((d) => /^\d{4}/.test(d))
      .sort();
    const weekRange =
      sortedDates.length > 0
        ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
        : { start: null, end: null };

    const result = buildPoolTimesResult(days, weekRange);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Updated ${outputPath}`);

    return result;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  Promise.all([scrape(), extractPoolTimes()]).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  BLOCKLIST,
  DEFAULT_OUTPUT_PATH,
  DEFAULT_POOL_TIMES_PATH,
  URL,
  assertScrapeLooksValid,
  buildPoolTimesResult,
  extractPageSummary,
  extractPoolTimes,
  findSessionArray,
  formatTimeValue,
  groupApiSessionsByDay,
  loadChromium,
  normalizeText,
  normalizeSessions,
  parseApiResponseForSessions,
  parseMonthDay,
  scrape,
};
