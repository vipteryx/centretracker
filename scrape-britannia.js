import axios from "axios";
import { load } from "cheerio";
import fs from "fs";

const URL = "https://vancouver.ca/parks-recreation-culture/britannia-pool.aspx";

function parseTable($, table) {
  const headers = [];
  $(table)
    .find("tr")
    .first()
    .find("th")
    .each((i, th) => {
      headers.push($(th).text().trim());
    });

  const data = {};
  $(table)
    .find("tr")
    .slice(1)
    .each((i, row) => {
      $(row)
        .find("td")
        .each((j, td) => {
          const cell = $(td);
          if (cell.find("ul li").length) {
            data[headers[j]] = cell
              .find("li")
              .map((_, li) => $(li).text().trim())
              .get();
          } else {
            data[headers[j]] = cell.text().trim();
          }
        });
    });

  return data;
}

async function scrapeBritannia() {
  try {
    const { data: html } = await axios.get(URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    const $ = load(html);

    const fitnessTable = $("h4:contains('Fitness centre hours')").next("table");
    const poolTable = $("h4:contains('Pool hours and schedule')").next("table");

    const fitnessHours = parseTable($, fitnessTable);
    const poolHours = parseTable($, poolTable);

    const output = {
      lastUpdated: new Date().toISOString(),
      fitnessCentreHours: fitnessHours,
      poolHours: poolHours,
    };

    fs.writeFileSync("britannia-hours.json", JSON.stringify(output, null, 2));
    console.log("Saved britannia-hours.json");
  } catch (err) {
    console.error(err);
  }
}

scrapeBritannia();
