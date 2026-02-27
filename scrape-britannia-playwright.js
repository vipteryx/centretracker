const fs = require("fs");

const URL =
  "https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2";
const DEFAULT_OUTPUT_PATH = "britannia-hours.json";
const DEFAULT_POOL_TIMES_PATH = "pool-times.json";
const BLOCKLIST = ["attention required", "sorry, you have been blocked", "cloudflare"];
// URL fragments that suggest a calendar/activity data API response worth capturing
const CALENDAR_API_URL_FRAGMENTS = ["/rest/", "calendar", "dropin", "activit"];

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
    return `${referenceYear}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
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

// Attempts to find an array of session-like objects in a captured API response body.
// Returns the array on success, or null if the shape doesn't match.
function parseApiResponseForSessions(jsonBody) {
  if (!jsonBody || typeof jsonBody !== "object") return null;
  const candidates = [
    jsonBody.body && jsonBody.body.activities,
    jsonBody.data,
    jsonBody.activities,
    jsonBody.calendar_items,
    jsonBody.result_set && jsonBody.result_set.body && jsonBody.result_set.body.activities,
    jsonBody.items,
    Array.isArray(jsonBody) ? jsonBody : null,
  ];
  const arr = candidates.find((c) => Array.isArray(c) && c.length > 0);
  if (!arr) return null;
  const first = arr[0];
  if (typeof first !== "object" || first === null) return null;
  const keys = Object.keys(first).map((k) => k.toLowerCase());
  const hasName = keys.some((k) =>
    ["name", "activityname", "activity_name", "title", "description"].includes(k)
  );
  const hasTime = keys.some((k) =>
    ["starttime", "start_time", "startdate", "start_date", "time", "date",
     "session_date", "activity_date"].includes(k)
  );
  return hasName && hasTime ? arr : null;
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
    const startRaw = s.start_time || s.startTime || s.start_date || s.startDate || s.time || "";
    const endRaw = s.end_time || s.endTime || s.end_date || s.endDate || "";
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
  return Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
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
    const capturedJsonPromises = [];
    page.on("response", (response) => {
      const responseUrl = response.url();
      const contentType = (response.headers()["content-type"] || "").toLowerCase();
      const isJson = contentType.includes("application/json");
      const isRelevant = CALENDAR_API_URL_FRAGMENTS.some((f) =>
        responseUrl.toLowerCase().includes(f)
      );
      if (isJson && isRelevant) {
        capturedJsonPromises.push(
          response
            .json()
            .then((body) => ({ url: responseUrl, body }))
            .catch(() => null)
        );
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Await all captured bodies (some may still be resolving post-networkidle)
    const capturedJsonResponses = (await Promise.all(capturedJsonPromises)).filter(Boolean);

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

    // Best-effort wait for the calendar grid to appear
    const CALENDAR_GRID_SELECTORS = [
      ".an-calendar-view",
      "[class*='calendar-view']",
      "[class*='CalendarView']",
      "[role='grid']",
      "table.calendar",
      ".calendar-container",
      "[class*='weekly-calendar']",
    ];
    let calendarVisible = false;
    for (const sel of CALENDAR_GRID_SELECTORS) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        calendarVisible = true;
        break;
      } catch {
        // Try next selector
      }
    }
    if (!calendarVisible) {
      console.warn(
        "Warning: Could not locate a known calendar selector; proceeding with extraction anyway."
      );
    }

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

    // --- Fallback: DOM extraction ---
    if (days.length === 0) {
      console.log("No matching API data captured; falling back to DOM extraction.");
      const rawDays = await page.evaluate(() => {
        const DAY_SELECTORS = [
          ".an-calendar-view__day",
          "[class*='calendar-day']",
          "[class*='CalendarDay']",
          "[class*='week-day']",
          "[role='gridcell']",
          "table.calendar tbody tr td",
        ];
        const SESSION_SELECTORS = [
          "[class*='activity']",
          "[class*='event']",
          "[class*='session']",
          ".an-activity",
          ".drop-in-activity",
          "[class*='dropin']",
        ];
        const FIELD_SELECTORS = {
          name: "[class*='name'], [class*='title'], [class*='activity-name']",
          time: "[class*='time'], [class*='hours'], time",
          location: "[class*='location'], [class*='facility'], [class*='room']",
          status: "[class*='status'], [class*='availability']",
        };

        function getFieldText(el, selector) {
          const found = el.querySelector(selector);
          return found ? found.textContent.trim() : "";
        }

        let dayContainers = [];
        for (const sel of DAY_SELECTORS) {
          const found = Array.from(document.querySelectorAll(sel));
          if (found.length >= 5) {
            dayContainers = found;
            break;
          }
        }
        if (dayContainers.length === 0) return [];

        return dayContainers.map((dayEl) => {
          const headerEl = dayEl.querySelector(
            "[class*='date'], [class*='header'], [class*='heading'], h2, h3, h4, strong"
          );
          const rawDate = headerEl ? headerEl.textContent.trim() : "";

          let sessionEls = [];
          for (const ssel of SESSION_SELECTORS) {
            const found = Array.from(dayEl.querySelectorAll(ssel));
            if (found.length > 0) {
              sessionEls = found;
              break;
            }
          }

          const sessions = sessionEls.map((el) => ({
            name: getFieldText(el, FIELD_SELECTORS.name) || el.textContent.trim(),
            time: getFieldText(el, FIELD_SELECTORS.time),
            location: getFieldText(el, FIELD_SELECTORS.location),
            status: getFieldText(el, FIELD_SELECTORS.status),
          }));

          return { rawDate, sessions };
        });
      });

      days = rawDays
        .filter((d) => d.sessions.length > 0)
        .map((d) => {
          const isoDate = parseMonthDay(d.rawDate, referenceYear);
          const dayOfWeek = isoDate
            ? new Date(isoDate).toLocaleDateString("en-US", {
                weekday: "long",
                timeZone: "UTC",
              })
            : "";
          return {
            date: isoDate || d.rawDate,
            dayOfWeek,
            sessions: d.sessions.map((s) => {
              const out = { name: normalizeText(s.name) };
              if (s.time) out.time = normalizeText(s.time);
              if (s.location) out.location = normalizeText(s.location);
              if (s.status) out.status = normalizeText(s.status);
              return out;
            }),
          };
        });
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
  CALENDAR_API_URL_FRAGMENTS,
  DEFAULT_OUTPUT_PATH,
  DEFAULT_POOL_TIMES_PATH,
  URL,
  assertScrapeLooksValid,
  buildPoolTimesResult,
  extractPageSummary,
  extractPoolTimes,
  formatTimeValue,
  groupApiSessionsByDay,
  loadChromium,
  normalizeText,
  normalizeSessions,
  parseApiResponseForSessions,
  parseMonthDay,
  scrape,
};
