// ✅ fetchRent.ts – doar închirieri
import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { buildings } from "../../data/buildings";

interface Listing {
  price: string;
  area: string;
  location: string;
  url: string;
}

const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

const isValidArea = (area: string): boolean => {
  return /^\d{2,4}\s?m²$/.test(area);
};

const extractListingsFromPage = async (page: Page): Promise<Listing[]> => {
  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div[data-cy='l-card']"));
    return cards.map((el) => {
      const price = el.querySelector("[data-testid='ad-price']")?.textContent?.trim() ?? "N/A";
      const location = el.querySelector("[data-testid='location-date']")?.textContent?.trim() ?? "N/A";
      const area = Array.from(el.querySelectorAll("li"))
        .find(li => li.textContent?.includes("m²"))?.textContent?.trim() ?? "N/A";
      const linkEl = el.querySelector("a[href*='/d/oferta/']");
      const url = linkEl ? (linkEl.getAttribute("href")?.startsWith("/")
        ? `https://www.olx.ro${linkEl.getAttribute("href")}`
        : linkEl.getAttribute("href") ?? "") : "";
      return { price, area, location, url };
    }).filter(l => l.price !== "N/A" && l.url);
  });
};

const fetchListings = async (page: Page, baseUrl: string): Promise<Listing[]> => {
  const olxUrl = `${baseUrl}&page=1`;
  await page.goto(olxUrl, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForSelector("div[data-cy='l-card']", { timeout: 10000 });
  const listings = await extractListingsFromPage(page);
  return listings
    .map((listing) => ({ ...listing, price: cleanPriceText(listing.price) }))
    .filter((listing) => isValidArea(listing.area));
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
  }

  const baseOlxUrl = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/q-${encodeURIComponent(name)}/?currency=RON`;

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`,
    });
    const page = await browser.newPage();
    const listings = await fetchListings(page, baseOlxUrl);
    return NextResponse.json({ rent: listings });
  } catch (error) {
    return NextResponse.json({ rent: [], error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
