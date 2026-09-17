export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
    const slug = extractSlug(url);

    if (!slug) {
      return fetch(request);
    }

    const bots = [
      "whatsapp",
      "facebookexternalhit",
      "facebot",
      "twitterbot",
      "linkedinbot",
      "telegrambot",
      "instagram",
      "tiktokbot",
      "pinterest",
      "discordbot",
      "skypeuripreview"
    ];

    const isBot = bots.some(bot => userAgent.includes(bot));

    if (isBot) {
      try {
        const productData = await fetchProductFromFirebaseStructuredQuery(slug, env);
        if (productData) {
          return generateSocialPreviewHTML(productData, url.href);
        }
      } catch (err) {
        console.error("Firebase fetch error:", err);
      }
    }

    return fetch(request);
  }
};

function extractSlug(url) {
  const searchStr = url.search;
  if (!searchStr) return null;
  let cleanQuery = searchStr.substring(1);
  let parts = cleanQuery.split(/[?&]/);
  if (parts.length > 0 && parts[0]) {
    let candidate = decodeURIComponent(parts[0].trim());
    const trackingKeys = ['fbclid', 'gclid', 'dclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
    if (trackingKeys.includes(candidate.split('=')[0])) {
      return null;
    }
    return candidate.split('=')[0];
  }
  return null;
}

async function fetchProductFromFirebaseStructuredQuery(slug, env) {
  const projectId = "ghotimarket";
  const firestoreQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: "landing_product" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "productSlug" },
          op: "EQUAL",
          value: { stringValue: slug }
        }
      },
      limit: 1
    }
  };

  try {
    const response = await fetch(firestoreQueryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryPayload)
    });
    if (!response.ok) return null;
    const results = await response.json();
    if (results && results.length > 0 && results[0].document) {
      const fields = results[0].document.fields;
      return {
        productName: fields.productName?.stringValue || "Product",
        productDescription: fields.productDescription?.stringValue || "Ghoti Market Product",
        productImage: fields.productImage?.arrayValue?.values?.map(v => v.stringValue) || []
      };
    }
  } catch (e) {
    console.error("Query Error:", e);
  }
  return null;
}

function generateSocialPreviewHTML(product, currentUrl) {
  const title = `${product.productName} | GHOTI MARKET`;
  const description = product.productDescription.substring(0, 160);
  const image = (product.productImage && product.productImage.length > 0)? product.productImage[0] : "https://www.ghotimarket.com/watermark.png";

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">

    <!-- Open Graph - For Big Card -->
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="Ghoti Market">
    <meta property="og:url" content="${escapeHtml(currentUrl)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">

    <!-- Twitter / WhatsApp Large Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(currentUrl)}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
    <h1>${escapeHtml(product.productName)}</h1>
    <p>${escapeHtml(description)}</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=3600"
    },
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
}
