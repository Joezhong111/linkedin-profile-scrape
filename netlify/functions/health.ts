// Netlify Function: /.netlify/functions/health
// Returns readiness of server-side secrets like APIFY_TOKEN
export const handler = async () => {
  const token = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || "";
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apify: Boolean(token) }),
  };
};

