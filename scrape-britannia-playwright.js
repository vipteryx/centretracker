import { chromium } from "playwright";
import fs from "fs";
import cheerio from "cheerio";

const URL = "https://vancouver.ca/parks-recreation-culture/britannia-pool.aspx";

async function scrape() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);

  const result = {
    lastUpdated: new Date().toISOString(),
    fitnessCentreHours: {},
    poolHours: {}
  };

  function parseTable(table) {
    const rows = $(table).find("tr").toArray();
    if (rows.length < 2) return {};

    const headers = $(rows[0]).find("th,td").toArray().map(c => $(c).text().trim());
    const values = $(rows[1]).find("td").toArray().map(c =>
      $(c).text().trim().replace(/\s+/g, " ")
    );

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  }

  $("h2, h3, h4").each((_, el) => {
    const heading = $(el).text().trim();

    if (heading === "Fitness centre hours") {
      const table = $(el).nextAll("table").first();
      result.fitnessCentreHours = parseTable(table);
    }

    if (heading === "Pool hours and schedule") {
      const table = $(el).nextAll("table").first();
      result.poolHours = parseTable(table);
    }
  });

  fs.writeFileSync("britannia-hours.json", JSON.stringify(result, null, 2));
  console.log("Updated britannia-hours.json");
}

scrape().catch(err => {
  console.error(err);
  process.exit(1);
});
