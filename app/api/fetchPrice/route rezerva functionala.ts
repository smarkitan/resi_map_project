import { NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer";

// Definim tipul pentru un anunț OLX
interface Listing {
  price: string;
  url: string;
}

// Funcție pentru curățarea prețului
const cleanPriceText = (price: string): string => {
  return price.replace("Prețul e negociabil", "").trim();
};

// Funcție pentru extragerea anunțurilor de pe o pagină OLX
const extractListingsFromPage = async (page: Page): Promise<Listing[]> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("div[data-cy='l-card']")).map((el) => {
      const priceElement = el.querySelector(".css-6j1qjp");
      const linkElement = el.querySelector("a");

      return {
        price: priceElement ? priceElement.textContent!.trim() : "N/A",
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

    await page.goto(olxUrl, { waitUntil: "networkidle2" });

    console.log(`⏳ Extracting listings from page ${i}...`);
    const listings = await extractListingsFromPage(page);

    console.log(`✅ Found ${listings.length} listings on page ${i}`);

    allListings = allListings.concat(listings);
  }

  console.log(`🔍 Total listings extracted: ${allListings.length}`);

  return allListings.map((listing) => ({
    ...listing,
    price: cleanPriceText(listing.price),
  }));
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address: string | null = searchParams.get("address");
  const name: string | null = searchParams.get("name");

  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  console.log(`🟢 Searching prices for: Address - ${address}, Name - ${name}`);

  // Generăm URL-ul de căutare cu numele ansamblului în query
  const baseOlxUrl_SALE = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/q-${encodeURIComponent(name)}/?currency=EUR`;
  const baseOlxUrl_RENT = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/q-${encodeURIComponent(name)}/?currency=EUR`;

  const browser: Browser = await puppeteer.launch({ headless: true });
  const page: Page = await browser.newPage();

  try {
    // Căutăm anunțurile de vânzare
    const saleListings = await fetchListings(page, baseOlxUrl_SALE);
    console.log(`✅ Found ${saleListings.length} sale listings`);

    // Căutăm anunțurile de închiriere
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
