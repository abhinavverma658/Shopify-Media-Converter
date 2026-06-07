// web/backend/routes/webhooks.js
import express from "express";

const router = express.Router();

// App uninstalled webhook handler
router.post("/app-uninstalled", express.raw({ type: "application/json" }), (req, res) => {
  console.log("App uninstalled webhook received");
  // Clean up shop data if needed
  res.status(200).send("OK");
});

export default router;
