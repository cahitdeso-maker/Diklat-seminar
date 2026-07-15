/**
 * API Key Authentication Middleware
 * 
 * Memvalidasi header X-API-KEY di setiap request
 * Kecuali untuk endpoint healthcheck (/health)
 */

const API_KEY = process.env.API_KEY;

function apiKeyAuth(req, res, next) {
  // Skip auth untuk healthcheck
  if (req.path === "/health" || req.path === "/") {
    return next();
  }

  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: X-API-KEY header required",
    });
  }

  if (apiKey !== API_KEY) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid API key",
    });
  }

  next();
}

module.exports = apiKeyAuth;
