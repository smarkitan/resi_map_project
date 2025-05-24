import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { buildings } from "../../data/buildings"; // Lista cu orașe/districte valide

// Tipul pentru listare
interface Listing {
  price: string;
  area: string;
  location: string;
  url: string;
}

// Curățare preț
const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

// Validare suprafață (ex: 45 m²)
const isValidArea = (area: string): boolean => {
  return /^\d{2,4}\s?m²$/.test(area);
};

// Validare locație pe baza orașelor/districtelor din `buildings`
const matchesLocation = (text: string): boolean => {
  const locations = buildings.flatMap((building) => [building.city, building.district])
                             .map((loc) => loc.toLowerCase());
  return locations.some((loc) => text.toLowerCase().includes(loc));
};

// Extragere anunțuri de pe pagina OLX
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
          : linkEl.getAttribute("href")
        : "";

      return { price, area, location, url };
    }).filter(l => l.price !== "N/A" && l.url);
  });
};

// Căutăm anunțuri de vânzare pe 1 pagină
const fetchListings = async (page: Page, baseUrl: string): Promise<Listing[]> => {
  let allListings: Listing[] = [];

  for (let i = 1; i <= 1; i++) {
    const olxUrl = `${baseUrl}&page=${i}`;
    console.log(`🔎 Accessing page ${i}: ${olxUrl}`);

    await page.goto(olxUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector("div[data-cy='l-card']", { timeout: 10000 });

    console.log(`⏳ Extracting listings from page ${i}...`);
    const listings = await extractListingsFromPage(page);

    console.log(`✅ Found ${listings.length} listings on page ${i}`);
    allListings = allListings.concat(listings);
  }

  console.log(`🔍 Total listings extracted: ${allListings.length}`);

  return allListings
    .map((listing) => ({
      ...listing,
      price: cleanPriceText(listing.price),
    }))
    .filter((listing) => isValidArea(listing.area) && matchesLocation(listing.location));
};

// Răspuns API: DOAR vânzări (pentru a evita timeoutul)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const name = searchParams.get("name");

  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  console.log("🧪 RUNNING PATCHED fetchPrice – SALE ONLY");
  console.log(`🟢 Searching prices for: Address - ${address}, Name - ${name}`);

  const baseOlxUrl_SALE = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/q-${encodeURIComponent(name)}/?currency=RON`;

  let browser: Browser | null = null;

  try {
    console.log("🚀 Connecting to Browserless...");
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`,
    });

    const page: Page = await browser.newPage();
    const saleListings = await fetchListings(page, baseOlxUrl_SALE);
    console.log(`✅ Found ${saleListings.length} sale listings`);

    return NextResponse.json({
      sale: saleListings,
      rent: [],
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
