import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer";
import { buildings } from "../../data/buildings"; // Import orașele și districtele

// Definim tipul pentru un anunț OLX
interface Listing {
  price: string;
  area: string;
  location: string;
  url: string;
}

// Funcție pentru curățarea prețului
const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

// Funcție pentru validarea suprafeței (2-4 cifre urmate de "m²")
const isValidArea = (area: string): boolean => {
  return /^\d{2,4}\s?m²$/.test(area);
};

// Funcție pentru verificarea locației în clasa css-1mwdrlh
const matchesLocation = (text: string): boolean => {
  const locations = buildings.flatMap((building) => [building.city, building.district])
                             .map((loc) => loc.toLowerCase());

  return locations.some((loc) => text.toLowerCase().includes(loc));
};

// Funcție pentru extragerea anunțurilor de pe o pagină OLX
const extractListingsFromPage = async (page: Page): Promise<Listing[]> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("div[data-cy='l-card']")).map((el) => {
      const priceElement = el.querySelector(".css-6j1qjp");
      const areaElement = el.querySelector(".css-6as4g5");
      const locationElement = el.querySelector(".css-1mwdrlh");
      const linkElement = el.querySelector("a");

      const areaText = areaElement ? areaElement.textContent!.trim() : "N/A";
      const locationText = locationElement ? locationElement.textContent!.trim() : "N/A";

      return {
        price: priceElement ? priceElement.textContent!.trim() : "N/A",
        area: areaText,
        location: locationText,
        url: linkElement
          ? linkElement.getAttribute("href")?.startsWith("/")
            ? `https://www.olx.ro${linkElement.getAttribute("href")}`
            : linkElement.getAttribute("href")!
          : "",
      };
    });
  });
};

// Funcție pentru căutarea anunțurilor pe OLX (2 pagini)
const fetchListings = async (page: Page, baseUrl: string): Promise<Listing[]> => {
  let allListings: Listing[] = [];

  for (let i = 1; i <= 2; i++) {
    const olxUrl = `${baseUrl}&page=${i}`;
    console.log(`🔎 Accessing page ${i}: ${olxUrl}`);

    await page.goto(olxUrl, { waitUntil: "networkidle2", timeout: 15000 });
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address: string | null = searchParams.get("address");
  const name: string | null = searchParams.get("name");

  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  console.log(`🟢 Searching prices for: Address - ${address}, Name - ${name}`);

  const baseOlxUrl_SALE = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/q-${encodeURIComponent(name)}/?currency=EUR`;
  const baseOlxUrl_RENT = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/q-${encodeURIComponent(name)}/?currency=EUR`;

  const browser: Browser = await puppeteer.launch({ headless: true });
  const page: Page = await browser.newPage();

  try {
    const saleListings = await fetchListings(page, baseOlxUrl_SALE);
    console.log(`✅ Found ${saleListings.length} sale listings`);

    const rentListings = await fetchListings(page, baseOlxUrl_RENT);
    console.log(`✅ Found ${rentListings.length} rental listings`);

    return NextResponse.json({
      sale: saleListings,
      rent: rentListings,
    });
  } catch (error) {
    console.error(`🔥 Error scraping OLX:`, error);
    return NextResponse.json({
      sale: [],
      rent: [],
    });
  } finally {
    await browser.close();
  }
}
