import axios from "axios";
import * as cheerio from "cheerio";

export interface ParsedProductData {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercentage: number;
  brandName?: string;
  thumbnailImageUrl: string;
  imageUrls: string[];
  tags: string[];
  keySpecifications: string[];
  originCountry?: string;
  ingredients?: string; // Technical Specs & Materials
  healthBenefits?: string; // Key Features & Highlights
  usageInstructions?: string; // Operating Guide / Instructions
  storageInstructions?: string; // Safety Warnings & Care
}

export async function parseProductLink(
  targetUrl: string,
): Promise<ParsedProductData> {
  // Ensure valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    throw new Error("Invalid URL provided");
  }

  // Realistic browser headers to avoid anti-bot blocks
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua":
      '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Upgrade-Insecure-Requests": "1",
  };

  const response = await axios.get(parsedUrl.toString(), {
    headers,
    timeout: 10000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);

  // --- 1. Product Name / Title ---
  let name =
    $("#productTitle").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // Clean title clutter
  name = name.replace(/\s+/g, " ");

  // --- 2. Images (Deduplicated by unique Amazon Image Core ID) ---
  const galleryImagesByCoreId = new Map<string, string>();

  const getImageCoreId = (url: string): string | null => {
    // Extract unique Amazon core image ID, e.g. /images/I/71xyzABC12L._AC_... => 71xyzABC12L
    const match = url.match(
      /\/images\/I\/([A-Za-z0-9%+\-_]+?)(?:\._|\.jpg|\.png|\.jpeg|\.webp|$)/i,
    );
    return match ? match[1] : null;
  };

  const toHighResUrl = (url: string): string => {
    // Convert Amazon thumbnail size specifications to max 1500px high res
    return url.replace(/\._[A-Z0-9_,]+_\./i, "._AC_SL1500_.");
  };

  const addImageCandidate = (url: string) => {
    if (!url || typeof url !== "string") return;
    if (
      url.includes("sprite") ||
      url.includes("pixel") ||
      url.includes("play-button") ||
      url.includes("icon") ||
      url.includes("logo") ||
      url.includes("G/01") ||
      url.includes("load-indicator")
    ) {
      return;
    }

    const highRes = toHighResUrl(url);
    const coreId = getImageCoreId(highRes);

    if (coreId) {
      if (!galleryImagesByCoreId.has(coreId)) {
        galleryImagesByCoreId.set(coreId, highRes);
      }
    } else if (!Array.from(galleryImagesByCoreId.values()).includes(highRes)) {
      galleryImagesByCoreId.set(highRes, highRes);
    }
  };

  // 2a. Parse inline script blocks containing colorImages / ImageBlockATF JSON
  const htmlData = response.data || "";
  const scriptRegexes = [
    /'colorImages':\s*\{\s*'initial':\s*(\[[\s\S]*?\])/,
    /"colorImages":\s*\{\s*"initial":\s*(\[[\s\S]*?\])/,
    /'ImageBlockATF':\s*(\[[\s\S]*?\])/,
  ];

  for (const regex of scriptRegexes) {
    const match = htmlData.match(regex);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          parsed.forEach((imgObj: any) => {
            const rawUrl =
              imgObj.hiRes || imgObj.large || imgObj.mainUrl || imgObj.variant;
            if (rawUrl) addImageCandidate(rawUrl);
          });
        }
      } catch (e) {
        // Regex fallback scan for media amazon image URLs in the script match
        const matches = match[1].match(
          /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+\-_]+\.(?:jpg|png)/gi,
        );
        if (matches) {
          matches.forEach((u: string) => addImageCandidate(u));
        }
      }
    }
  }

  // 2b. Parse landing image dynamic attributes
  const dynamicImagesAttr = $("#landingImage").attr("data-a-dynamic-image");
  if (dynamicImagesAttr) {
    try {
      const parsedImages = JSON.parse(dynamicImagesAttr);
      const keys = Object.keys(parsedImages);
      if (keys.length > 0) {
        addImageCandidate(keys[0]);
      }
    } catch (e) {}
  }

  // 2c. Landing image element fallbacks
  const landingSrc =
    $("#landingImage").attr("src") ||
    $("#landingImage").attr("data-old-hires") ||
    $("#imgBlkFront").attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");

  if (landingSrc) addImageCandidate(landingSrc);

  // 2d. Alt images gallery elements
  $("#altImages img, #imageBlock img, #thumbs-grid img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-old-hires") ||
      $(el).attr("data-a-hires");
    if (src) addImageCandidate(src);
  });

  // 2e. Meta tag images
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) addImageCandidate(content);
  });

  const extractedUrls = Array.from(galleryImagesByCoreId.values());
  const thumbnailImageUrl = extractedUrls[0] || "";
  const imageUrls = extractedUrls.slice(1, 10);

  // --- 3. Price & Discount ---
  let price = 0;
  let originalPrice = 0;

  // Amazon offscreen price selector
  const offscreenPrices: string[] = [];
  $(
    ".a-price .a-offscreen, .priceToPay .a-offscreen, .apexPriceToPay .a-offscreen, #corePrice_desktop .a-offscreen, #corePrice_feature_div .a-offscreen, span.a-color-price, #priceblock_ourprice, #priceblock_dealprice, #priceblock_saleprice, span.a-price-whole",
  ).each((_, el) => {
    const pText = $(el).text().trim();
    if (pText) offscreenPrices.push(pText);
  });

  const priceElements = [
    ...offscreenPrices,
    $('meta[property="og:price:amount"]').attr("content") || "",
    $('meta[property="product:price:amount"]').attr("content") || "",
  ].filter(Boolean);

  const parsedNumbers: number[] = [];
  priceElements.forEach((str) => {
    // Handle price string formatting (e.g. "$199.99" or "₹14,999.00" or "199.99")
    const cleanStr = str.replace(/,/g, "").replace(/[^0-9.]/g, "");
    const val = parseFloat(cleanStr);
    if (!isNaN(val) && val > 0) {
      parsedNumbers.push(val);
    }
  });

  if (parsedNumbers.length > 0) {
    price = parsedNumbers[0]; // Primary deal/selling price
    if (parsedNumbers.length > 1 && parsedNumbers[1] > price) {
      originalPrice = parsedNumbers[1];
    }
  }

  // Amazon strike-through price (List price / MRP)
  const strikethroughText =
    $(".a-price[data-a-stripe='true'] .a-offscreen").first().text().trim() ||
    $(".a-text-price .a-offscreen").first().text().trim();

  if (strikethroughText) {
    const cleanMrp = parseFloat(strikethroughText.replace(/[^0-9.]/g, ""));
    if (!isNaN(cleanMrp) && cleanMrp > price) {
      originalPrice = cleanMrp;
    }
  }

  let discountPercentage = 0;
  if (originalPrice > price && price > 0) {
    discountPercentage = Math.round(
      ((originalPrice - price) / originalPrice) * 100,
    );
  }

  // --- 4. Brand ---
  const brandName =
    $("#bylineInfo")
      .text()
      .replace(/Visit the|Brand:|Store/gi, "")
      .trim() ||
    $('meta[property="product:brand"]').attr("content")?.trim() ||
    "";

  // --- 5. Feature Bullets & Description ---
  const keySpecifications: string[] = [];
  $("#feature-bullets ul li span.a-list-item").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text &&
      text.length > 3 &&
      !text.toLowerCase().includes("make sure this fits")
    ) {
      keySpecifications.push(text);
    }
  });

  let description =
    keySpecifications.join("\n\n") ||
    $("#productDescription").text().trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";

  description = description.replace(/\s+/g, " ").trim();

  // --- 6. Technical Specs & Materials (ingredients) ---
  const techSpecsArray: string[] = [];
  $(
    "#productDetails_techSpec_section_1 tr, #technicalSpecifications_feature_div tr, #poExpander tr, .prodDetTable tr",
  ).each((_, el) => {
    const key = $(el).find("th, td.prodDetSectionEntry").text().trim();
    const val = $(el).find("td:not(.prodDetSectionEntry)").text().trim();
    if (key && val && key.length < 40 && val.length < 200) {
      techSpecsArray.push(`${key}: ${val}`);
    }
  });
  const ingredients =
    techSpecsArray.slice(0, 8).join(", ") ||
    keySpecifications.slice(0, 3).join(", ");

  // --- 7. Key Features & Highlights (healthBenefits) ---
  const healthBenefits = keySpecifications.slice(0, 4).join(". ") || "";

  // --- 8. Operating Guide & Instructions (usageInstructions) ---
  let usageInstructions = "";
  $("#important-information, #importantInformation").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.toLowerCase().includes("directions") ||
      text.toLowerCase().includes("instruction") ||
      text.toLowerCase().includes("how to use")
    ) {
      usageInstructions = text;
    }
  });
  if (!usageInstructions && keySpecifications.length > 4) {
    usageInstructions = keySpecifications.slice(4, 6).join(". ");
  }

  // --- 9. Safety Warnings & Care (storageInstructions) ---
  let storageInstructions = "";
  $("#important-information, #importantInformation").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.toLowerCase().includes("safety") ||
      text.toLowerCase().includes("warning") ||
      text.toLowerCase().includes("care")
    ) {
      storageInstructions = text;
    }
  });

  // --- 10. Tags Generation ---
  const tagsSet = new Set<string>();
  if (brandName) tagsSet.add(brandName.toLowerCase());

  // Extract keywords from title
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !["with", "from", "that", "this", "for", "and"].includes(w),
    );

  words.slice(0, 5).forEach((w) => tagsSet.add(w));

  return {
    name,
    description,
    price,
    originalPrice: originalPrice > 0 ? originalPrice : undefined,
    discountPercentage,
    brandName,
    thumbnailImageUrl,
    imageUrls,
    tags: Array.from(tagsSet),
    keySpecifications,
    originCountry: "India",
    ingredients: ingredients || undefined,
    healthBenefits: healthBenefits || undefined,
    usageInstructions: usageInstructions || undefined,
    storageInstructions: storageInstructions || undefined,
  };
}
