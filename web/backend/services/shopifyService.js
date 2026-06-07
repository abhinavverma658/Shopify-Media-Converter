// web/backend/services/shopifyService.js
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * Fetch ALL products with pagination (handles 200+ products via cursor)
 */
export async function fetchAllProductsWithMedia(shop, accessToken) {
  const products = [];
  let pageInfo = null;

  do {
    const url = `https://${shop}/admin/api/2024-01/products.json?limit=50&fields=id,title,images${
      pageInfo ? `&page_info=${pageInfo}` : ""
    }`;
    const response = await axios.get(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    products.push(...response.data.products);

    const linkHeader = response.headers["link"] || "";
    pageInfo = null;
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]*).*?>; rel="next"/);
    if (nextMatch) pageInfo = nextMatch[1];
  } while (pageInfo);

  return products;
}

/**
 * Scan store — return all images that need converting
 */
export async function scanProductsForConversion(shop, accessToken) {
  const products = await fetchAllProductsWithMedia(shop, accessToken);
  const summary = {
    totalProducts: products.length,
    imagesToConvert: [],
    videosToConvert: [],
    alreadyWebP: 0,
    alreadyWebM: 0,
  };

  for (const product of products) {
    for (const image of product.images || []) {
      const ext = image.src?.split("?")[0].split(".").pop()?.toLowerCase();
      if (ext === "jpg" || ext === "jpeg" || ext === "png") {
        summary.imagesToConvert.push({
          productId: product.id,
          productTitle: product.title,
          imageId: image.id,
          src: image.src,
          width: image.width,
          height: image.height,
          position: image.position,  // preserve ordering
          alt: image.alt || "",
          type: "image",
          ext,
        });
      } else if (ext === "webp") {
        summary.alreadyWebP++;
      }
    }
  }

  return summary;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a converted file to Shopify via staged uploads (GraphQL)
 * Returns the CDN URL of the uploaded file.
 */
export async function uploadFileToShopify(shop, accessToken, filePath, filename) {
  const mimeType = filename.endsWith(".webm") ? "video/webm" : "image/webp";
  const fileSize = fs.statSync(filePath).size.toString();

  // Step 1: Get a staged upload target (S3 presigned URL)
  const stagedResponse = await axios.post(
    `https://${shop}/admin/api/2024-01/graphql.json`,
    {
      query: `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
      variables: {
        input: [{
          filename,
          mimeType,
          httpMethod: "POST",
          fileSize,
          resource: filename.endsWith(".webm") ? "VIDEO" : "IMAGE",
        }],
      },
    },
    { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
  );

  const errors = stagedResponse.data?.data?.stagedUploadsCreate?.userErrors;
  if (errors?.length) throw new Error(`Staged upload error: ${errors[0].message}`);

  const target = stagedResponse.data?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) throw new Error("No staged upload target returned");

  // Step 2: POST file to Shopify's S3 bucket
  const form = new FormData();
  for (const param of target.parameters) form.append(param.name, param.value);
  form.append("file", fs.createReadStream(filePath), { filename, contentType: mimeType });

  await axios.post(target.url, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  // resourceUrl is the CDN URL we can use to attach to a product
  return target.resourceUrl;
}

// ─── AUTO-REPLACE product image ───────────────────────────────────────────────

/**
 * Fully replaces a product image with the converted WebP version:
 *   1. Creates a new product image using the uploaded WebP CDN URL
 *   2. Preserves alt text and position
 *   3. Deletes the original JPG/PNG image
 *
 * This means the product in Shopify admin will automatically show
 * the WebP image — NO manual work needed.
 */
export async function replaceProductImage(shop, accessToken, productId, oldImageId, webpCdnUrl, { alt = "", position = 1 } = {}) {
  const headers = { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };
  const base = `https://${shop}/admin/api/2024-01/products/${productId}`;

  // Step 1: Create new image pointing to the WebP CDN URL
  const createRes = await axios.post(
    `${base}/images.json`,
    {
      image: {
        src: webpCdnUrl,
        alt,
        position,
      },
    },
    { headers }
  );

  const newImage = createRes.data?.image;
  if (!newImage?.id) {
    throw new Error(`Failed to create new WebP image for product ${productId}`);
  }

  // Step 2: Delete the original JPG/PNG image
  try {
    await axios.delete(`${base}/images/${oldImageId}.json`, { headers });
  } catch (err) {
    // Non-fatal — image was already replaced, just couldn't clean up old one
    console.warn(`Could not delete old image ${oldImageId} for product ${productId}:`, err.message);
  }

  return newImage;
}

/**
 * Get basic shop info
 */
export async function getShopInfo(shop, accessToken) {
  const response = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  return response.data?.shop;
}
