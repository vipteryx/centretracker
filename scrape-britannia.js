const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const URL = "https://vancouver.ca/parks-recreation-culture/britannia-pool.aspx";

async function scrape() {
  const { data: html } = await axios.get(URL, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  }
});

  const $ = cheerio.load(html);

  const result = {
    lastUpdated: new Date().toISOString(),
    fitnessCentreHours: {},
    poolHours: {}
  };

  function parseFitnessTable(table) {
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

  function parsePoolTable(table) {
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

  $("h4, h3, h2").each((_, el) => {
    const heading = $(el).text().trim();

    if (heading === "Fitness centre hours") {
      const table = $(el).next("table");
      result.fitnessCentreHours = parseFitnessTable(table);
    }

    if (heading === "Pool hours and schedule") {
      const table = $(el).next("table");
      result.poolHours = parsePoolTable(table);
    }
  });

  fs.writeFileSync("britannia-hours.json", JSON.stringify(result, null, 2), "utf8");
  console.log("Updated britannia-hours.json");
}

scrape().catch(err => {
  console.error(err);
  process.exit(1);
});
