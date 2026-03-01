
// Enhanced logging added around lines 254-259
function logJSONResponse(response) {
    console.log("Response Status: " + response.status);
    response.json().then(data => {
        console.log("Response Data: ", data);
    }).catch(err => {
        console.error("Error parsing JSON: ", err);
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // SPAs often fire XHR after the initial networkidle; wait for any FullCalendar
    // event element to appear so we don't miss late-loading calendar data.
    try {
      await page.waitForSelector('.fc-event, .fc-timegrid-event, .fc-daygrid-event', { timeout: 10000 });
    } catch {
      // Calendar may be empty or use different selectors; continue anyway
    }

    // Await all captured bodies (some may still be resolving post-networkidle)
    const capturedJsonResponses = (await Promise.all(capturedJsonPromises)).filter(Boolean);

    if (capturedJsonResponses.length > 0) {
      console.log(`Captured ${capturedJsonResponses.length} JSON response(s):`);
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
  Promise.all([scrape(), extractPoolTimes()]).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Other existing functions...
