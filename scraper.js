const fs = require("fs");

const URL =
  "https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2";
const DEFAULT_OUTPUT_PATH = "page-summary.json";
const DEFAULT_POOL_TIMES_PATH = "pool-times.json";

const URL_BRITANNIA =
  "https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=37&displayType=0&view=2";
const OUTPUT_PATH_BRITANNIA = "britannia-page-summary.json";
const POOL_TIMES_PATH_BRITANNIA = "britannia-pool-times.json";

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
// Requires both name-like and time/date-like keys, AND that at least one time-like
// key carries a real non-empty value (so navigation menu arrays with null date
// fields are not mistakenly returned). Depth-limited.
function findSessionArray(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 6 || obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      const firstKeys = Object.keys(obj[0]);
      const lowerKeys = firstKeys.map((k) => k.toLowerCase());
      const hasTime = lowerKeys.some((k) => /time|date|start|end|when/.test(k));
      const hasName = lowerKeys.some((k) => /name|title|desc|activ|event/.test(k));
      if (hasTime && hasName) {
        // Guard against navigation/category arrays where every time-like field is
        // null or empty — real session arrays always have at least one actual value.
        const timeKeys = firstKeys.filter((k) => /time|date|start|end|when/i.test(k));
        const sample = obj.slice(0, Math.min(obj.length, 5));
        const hasRealTimeValue = sample.some((item) =>
          timeKeys.some((k) => {
            const v = item[k];
            return v !== null && v !== undefined && v !== "";
          })
        );
        if (hasRealTimeValue) return obj;
      }
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

    // SPAs (and especially web components like <active-calendar-scheduler>)
    // often dispatch their own data-fetch *after* the host page reaches
    // networkidle.  Give those deferred XHRs a moment to fire and settle
    // before we collect capturedJsonPromises.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Wait for the web component's Shadow DOM to render at least one event.
    // active-calendar-scheduler v3.5.0 (from static-cdn.active.com) uses
    // FullCalendar internally, but we also probe generic data-date attributes
    // and common scheduler event class names in case the internal library
    // differs between versions.
    try {
      await page.waitForFunction(
        () => {
          const calEl = document.getElementById("calendar");
          if (!calEl || !calEl.shadowRoot) return false;
          return calEl.shadowRoot.querySelector(
            'td.fc-timegrid-col[data-date], td.fc-daygrid-day[data-date], .fc-event, [data-date], .scheduler-event, .event-block, .cal-event'
          ) !== null;
        },
        { timeout: 20000 }
      );
    } catch {
      // Shadow DOM not accessible or no events rendered; continue anyway
    }

    // Await all captured bodies (some may still be resolving post-networkidle)
    const capturedJsonResponses = (await Promise.all(capturedJsonPromises)).filter(Boolean);

    // Write every captured JSON response (URL + 500-char body preview) to a
    // persistent debug file so CI runs can be diagnosed without re-scraping.
    const debugApiEntries = capturedJsonResponses.map(({ url: u, body }) => ({
      url: u,
      preview: JSON.stringify(body).slice(0, 500),
    }));
    fs.writeFileSync("debug-api-responses.json", JSON.stringify(debugApiEntries, null, 2));

    if (capturedJsonResponses.length > 0) {
      console.log(`Captured ${capturedJsonResponses.length} JSON response(s) (see debug-api-responses.json):`);
      capturedJsonResponses.forEach(({ url: u, body }) => {
        console.log(`  ${u}`);
        const preview = JSON.stringify(body).slice(0, 300);
        console.log(`    Preview: ${preview}`);
      });
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
      if (!rawSessions) continue;
      const candidate = groupApiSessionsByDay(rawSessions, referenceYear);
      // Reject navigation/category arrays: require at least one day with a
      // real ISO date AND at least one session carrying a time value.
      const hasRealSessions = candidate.some(
        (d) => /^\d{4}/.test(d.date) && d.sessions.some((s) => s.time)
      );
      if (!hasRealSessions) {
        console.log(`Skipping API response (no dated sessions with times): ${respUrl}`);
        continue;
      }
      console.log(`Using API data from: ${respUrl}`);
      days = candidate;
      break;
    }

    // --- Fallback: Shadow DOM extraction via FullCalendar Web Component ---
    if (days.length === 0) {
      console.log("No matching API data captured; falling back to Shadow DOM extraction.");

      const rawDays = await page.evaluate(() => {
        // Use Shadow DOM if available (Web Component calendar), otherwise fall back to document
        const calEl = document.getElementById('calendar');
        const queryRoot = (calEl && calEl.shadowRoot) ? calEl.shadowRoot : document;

        // Try timegrid (week/day) view first, then daygrid (month) view
        let dayCols = Array.from(queryRoot.querySelectorAll('td.fc-timegrid-col[data-date]'));
        if (dayCols.length === 0) {
          dayCols = Array.from(queryRoot.querySelectorAll('td.fc-daygrid-day[data-date]'));
        }
        if (dayCols.length === 0) return [];

        return dayCols.map(col => {
          const date = col.getAttribute('data-date');
          // Top-level event starts only (fc-event-start avoids double-counting multi-day spans)
          const eventEls = Array.from(
            col.querySelectorAll('.fc-timegrid-event.fc-event-start, .fc-daygrid-event.fc-event-start')
          );
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

    // Always save rendered HTML so every run leaves an inspectable artefact.
    const debugHtml = await page.content();
    fs.writeFileSync("debug-page.html", debugHtml);
    if (days.length === 0) {
      console.warn("Extraction yielded no sessions. Inspect debug-page.html for details.");
    } else {
      console.log("Saved rendered HTML to debug-page.html.");
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
  Promise.all([
    scrape(),
    extractPoolTimes(),
    scrape(URL_BRITANNIA, OUTPUT_PATH_BRITANNIA),
    extractPoolTimes(URL_BRITANNIA, POOL_TIMES_PATH_BRITANNIA),
  ]).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  BLOCKLIST,
  DEFAULT_OUTPUT_PATH,
  DEFAULT_POOL_TIMES_PATH,
  OUTPUT_PATH_BRITANNIA,
  POOL_TIMES_PATH_BRITANNIA,
  URL,
  URL_BRITANNIA,
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
