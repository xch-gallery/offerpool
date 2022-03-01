const { getOfferSummary, getOfferValidity } = require("./get-offer-summary");
const { getTableName } = require("./get-table-name");
const { pool } = require("./query-db");
const { getCatInfo } = require("./cat-info-provider");
const logger = require("pino")();

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/** Adds an offer to the postgres table, returns false if the offer could not be added */
const addOfferEntryToPGDB = async (offer) => {
  try {
    const offerSummary = await getOfferSummary(offer);
    if (!offerSummary || !offerSummary.success) {
      return true;
    }
    const offered_cats = [];
    for (let cat in offerSummary.summary.offered) {
      offered_cats.push(cat);
    }
    const requested_cats = [];
    for (let cat in offerSummary.summary.requested) {
      requested_cats.push(cat);
    }
    const offerStatus = await getOfferValidity(offer);
    if (!offerStatus || !offerStatus.success) {
      return true;
    }

    let status = 0;
    if (offerStatus.valid) {
      status = 1;
    }
    const result = await pool.query(
      `INSERT into "${getTableName()}"(hash, offer, status, offered_cats, requested_cats, parsed_offer)
       VALUES (sha256($1), $2, $3, $4, $5, $6)`,
      [
        offer,
        offer,
        status,
        offered_cats,
        requested_cats,
        JSON.stringify(offerSummary.summary),
      ]
    );

    for (const cat of [...new Set([...requested_cats, ...offered_cats])]) {
      if (cat === "xch") {
        continue;
      }

      const { is_unknown } = await getCatInfo(cat);
      if (is_unknown) {
        logger.info({ cat }, "unknown cat, fetching from spacescan.io");

        const response = await fetch(
          `https://api2.spacescan.io/1/xch/token/summary/${cat}`
        );
        if (response.ok) {
          const { tokens } = await response.json();
          if (tokens.asset_name) {
            await pool.query(
              `INSERT into "${getTableName()}_cats_info" (id, "name", code, mojos_per_coin)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (id) DO NOTHING`,
              [tokens.asset_id, tokens.asset_name, tokens.symbol, 1000]
            );
          }
        }
      }
    }

    logger.info({ offer }, "added offer successfully");
  } catch (err) {
    logger.error({ offer, err }, "error adding offer");
    return false;
  }
  return true;
};

module.exports.addOfferEntryToPGDB = addOfferEntryToPGDB;
