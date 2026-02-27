const fs = require("fs");

const URL =
  "https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2";
const DEFAULT_OUTPUT_PATH = "britannia-hours.json";
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

    // Register BEFORE page.goto() so no responses are missed.
    // Capture ALL JSON responses (no URL filter) — content-type check is broad
    // so we don't miss endpoints that return text/json or application/x-json.
    const capturedJsonPromises = [];
    page.on("response", (response) => {
      const contentType = (response.headers()["content-type"] || "").toLowerCase();
      if (!contentType.includes("json")) return;
      const responseUrl = response.url();
      capturedJsonPromises.push(
        response
          .json()
          .then((body) => ({ url: responseUrl, body }))
          .catch(() => null)
      );
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Await all captured bodies (some may still be resolving post-networkidle)
    const capturedJsonResponses = (await Promise.all(capturedJsonPromises)).filter(Boolean);

    if (capturedJsonResponses.length > 0) {
      console.log(`Captured ${capturedJsonResponses.length} JSON response(s):`);
      capturedJsonResponses.forEach(({ url: u }) => console.log(`  ${u}`));
    } else {
      console.log("No JSON responses captured during page load.");
    }

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

    // --- Primary: try captured API responses ---
    for (const { url: respUrl, body } of capturedJsonResponses) {
      const rawSessions = parseApiResponseForSessions(body);
      if (rawSessions) {
        console.log(`Using API data from: ${respUrl}`);
        days = groupApiSessionsByDay(rawSessions, referenceYear);
        break;
      }
    }

    // --- Fallback: Shadow DOM extraction via FullCalendar Web Component ---
    if (days.length === 0) {
      console.log("No matching API data captured; falling back to Shadow DOM extraction.");

      const rawDays = await page.evaluate(() => {
        // The calendar is rendered inside a Shadow DOM Web Component
        const calEl = document.getElementById('calendar');
        if (!calEl || !calEl.shadowRoot) return [];
        const shadow = calEl.shadowRoot;
        // Get each day column — they carry a data-date attribute
        const dayCols = Array.from(shadow.querySelectorAll('td.fc-timegrid-col[data-date]'));
        if (dayCols.length === 0) return [];
        return dayCols.map(col => {
          const date = col.getAttribute('data-date');
          // Only top-level event starts (fc-event-start avoids double-counting multi-day spans)
          const eventEls = Array.from(col.querySelectorAll('.fc-timegrid-event.fc-event-start'));
          const sessions = eventEls.map(ev => {
            // aria-label format: "Center *Centre Name MMM D, YYYY H:MM AM - H:MM AM Activity |Name| Location"
            const ariaLabel = ev.getAttribute('aria-label') || '';
            const timeMatch = ariaLabel.match(
              /(\w{3}\s+\d+,\s+\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i
            );
            const activityMatch = ariaLabel.match(/Activity\s+\|([^|]+)\|\s*(.*)$/i);
            // Fallback: parse pipe-delimited textContent "|Name|Location"
            const text = (ev.textContent || '').replace(/\s+/g, ' ').trim();
            const parts = text.split('|').map(s => s.trim()).filter(Boolean);
            return {
              name: activityMatch ? activityMatch[1].trim() : (parts[0] || ''),
              location: activityMatch ? activityMatch[2].trim() : (parts[1] || ''),
              startTime: timeMatch ? timeMatch[2] : '',
              endTime: timeMatch ? timeMatch[3] : '',
            };
          });
          return { date, sessions };
        });
      });

      days = rawDays
        .filter(d => d.sessions.length > 0)
        .map(d => {
          const isoDate = d.date; // already ISO (data-date attribute)
          const dayOfWeek = isoDate
            ? new Date(isoDate).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
            : '';
          return {
            date: isoDate,
            dayOfWeek,
            sessions: d.sessions.map(s => ({
              name: normalizeText(s.name),
              location: normalizeText(s.location),
              time: s.startTime && s.endTime ? `${s.startTime} - ${s.endTime}` : normalizeText(s.startTime),
            })),
          };
        });
    }

    // Save rendered HTML for inspection if both paths came up empty.
    if (days.length === 0) {
      const debugHtml = await page.content();
      fs.writeFileSync("debug-page.html", debugHtml);
      console.warn("Extraction yielded no sessions. Saved rendered HTML to debug-page.html for inspection.");
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
