import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { buildings } from "../../data/buildings";

// Tip pentru listări
interface Listing {
  price: string;
  area: string;
  location: string;
  url: string;
}

// Curăță prețul
const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

// Validează suprafața (ex: 60 m²)
const isValidArea = (area: string): boolean => {
  return /^\d{2,4}\s?m²$/.test(area);
};

// Verifică dacă locația se potrivește cu orașele/districturile din buildings
const matchesLocation = (text: string): boolean => {
  const locations = buildings
    .flatMap((building) => [building.city, building.district])
    .map((loc) => loc.toLowerCase());

  return locations.some((loc) =>
    text.toLowerCase().includes(loc) || loc.includes(text.toLowerCase())
  );
};

// Extragere anunțuri din pagină OLX
const extractListingsFromPage = async (page: Page): Promise<Listing[]> => {
  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div[data-cy='l-card']"));

    return cards.map((el) => {
      const price = el.querySelector("[data-testid='ad-price']")?.textContent?.trim() ?? "N/A";
      const location = el.querySelector("[data-testid='location-date']")?.textContent?.trim() ?? "N/A";
      const area = Array.from(el.querySelectorAll("li"))
        .find(li => li.textContent?.includes("m²"))?.textContent?.trim() ?? "N/A";

      const linkEl = el.querySelector("a[href*='/d/oferta/']");
      const url = linkEl
        ? linkEl.getAttribute("href")?.startsWith("/")
          ? `https://www.olx.ro${linkEl.getAttribute("href")}`
          : linkEl.getAttribute("href") ?? ""
        : "";

      return { price, area, location, url };
    }).filter(l => l.price !== "N/A" && l.url);
  });
};

// Caută anunțuri OLX pe o pagină (vânzare sau închiriere)
const fetchListings = async (page: Page, baseUrl: string, debugMode = false): Promise<Listing[]> => {
  let allListings: Listing[] = [];

  const olxUrl = `${baseUrl}&page=1`;
  console.log(`🔎 Accessing: ${olxUrl}`);
  await page.goto(olxUrl, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForSelector("div[data-cy='l-card']", { timeout: 10000 });

  const listings = await extractListingsFromPage(page);
  console.log(`✅ Extracted ${listings.length} raw listings`);

  if (debugMode && listings.length > 0) {
    console.log("🧪 Debug: First 3 listings:");
    listings.slice(0, 3).forEach((l, i) => console.log(`#${i + 1}`, JSON.stringify(l, null, 2)));
  }

  const cleaned = listings
    .map((listing) => ({ ...listing, price: cleanPriceText(listing.price) }))
    .filter((listing) => isValidArea(listing.area) );

  console.log(`🔍 Filtered valid listings: ${cleaned.length}`);
  return cleaned;
};

// API handler
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const name = searchParams.get("name");
  const debug = searchParams.get("debug") === "true";

  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  console.log("🧪 RUNNING FULL fetchPrice (sale + rent) | Debug:", debug);
  console.log(`🟢 Search: Address=${address}, Name=${name}`);

  const baseOlxUrl_SALE = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/q-${encodeURIComponent(name)}/?currency=RON`;
  const baseOlxUrl_RENT = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/q-${encodeURIComponent(name)}/?currency=RON`;

  let browser: Browser | null = null;

  try {
    console.log("🚀 Connecting to Browserless...");
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`,
    });

    const page = await browser.newPage();

    const saleListings = await fetchListings(page, baseOlxUrl_SALE, debug);
    console.log(`✅ Sale listings: ${saleListings.length}`);

    const rentListings = await fetchListings(page, baseOlxUrl_RENT, debug);
    console.log(`✅ Rent listings: ${rentListings.length}`);

    return NextResponse.json({
      sale: saleListings,
      rent: rentListings,
    });

  } catch (error) {
    console.error("🔥 Error scraping OLX:", error);
    return NextResponse.json({
      sale: [],
      rent: [],
      error: error instanceof Error ? error.message : "Unknown error"
    });
  } finally {
    if (browser) {
      console.log("🔴 Closing browser...");
      await browser.close();
    }
  }
}
