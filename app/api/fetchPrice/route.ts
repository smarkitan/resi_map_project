import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { buildings } from "../../data/buildings"; // Import orașele și districtele

// Definim tipul pentru un anunț OLX
interface Listing {
  price: string;
  area: string;
  location: string;
  url: string;
}

// Curățăm prețul
const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

// Validăm suprafața (ex: 60 m²)
const isValidArea = (area: string): boolean => {
  return /^\d{2,4}\s?m²$/.test(area);
};

// Verificăm dacă locația se potrivește cu orașele/districtele relevante
const matchesLocation = (text: string): boolean => {
  const locations = buildings.flatMap((building) => [building.city, building.district])
                             .map((loc) => loc.toLowerCase());
  return locations.some((loc) => text.toLowerCase().includes(loc));
};

// Extragem anunțurile de pe o pagină OLX
const extractListingsFromPage = async (page: Page): Promise<Listing[]> => {
  return await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div[data-cy='l-card']"));

    return cards.map((el) => {
      const priceElement = el.querySelector("[data-testid='ad-price']") || el.querySelector("p[class*='price']");
      const areaElement = Array.from(el.querySelectorAll("li")).find(li => li.textContent?.includes("m²"));
      const locationElement = el.querySelector("[data-testid='location-date']") || el.querySelector("span[class*='location']");
      const linkElement = el.querySelector("a[href*='/d/oferta/']");

      const areaText = areaElement?.textContent?.trim() ?? "N/A";
      const locationText = locationElement?.textContent?.trim() ?? "N/A";
      const urlRaw = linkElement?.getAttribute("href") || "";

      return {
        price: priceElement?.textContent?.trim() ?? "N/A",
        area: areaText,
        location: locationText,
        url: urlRaw.startsWith("/") ? `https://www.olx.ro${urlRaw}` : urlRaw,
      };
    }).filter((l) => l.price !== "N/A" && l.url);
  });
};

// Căutăm anunțuri de vânzare/închiriere (max. 1 pagină pentru performanță)
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

// Handler API route
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address: string | null = searchParams.get("address");
  const name: string | null = searchParams.get("name");

  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  console.log(`🟢 Searching prices for: Address - ${address}, Name - ${name}`);

  const baseOlxUrl_SALE = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/q-${encodeURIComponent(name)}/?currency=RON`;
  const baseOlxUrl_RENT = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/q-${encodeURIComponent(name)}/?currency=RON`;

  let browser: Browser | null = null;

  try {
    console.log("🚀 Connecting to Browserless...");
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`,
    });

    const page: Page = await browser.newPage();

    const saleListings = await fetchListings(page, baseOlxUrl_SALE);
    console.log(`✅ Found ${saleListings.length} sale listings`);

    const rentListings = await fetchListings(page, baseOlxUrl_RENT);
    console.log(`✅ Found ${rentListings.length} rental listings`);

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
