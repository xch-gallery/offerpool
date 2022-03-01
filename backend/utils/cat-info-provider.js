const { getTableName } = require("./get-table-name");
const { pool } = require("./query-db");

let lastUpdate = undefined;
let cat_info = {};
let code_to_id = {};
const CAT_REFRESH_INTERVAL = 120;

const getCatInfo = async (cat_id) => {
  const cacheInvalidTime = new Date(
    new Date().getTime() - CAT_REFRESH_INTERVAL * 1000
  ).toISOString();
  if (!lastUpdate || lastUpdate < cacheInvalidTime) {
    await updateCatInfo();
  }

  // Allow callers to use the code
  if (cat_id && cat_id.toUpperCase && code_to_id[cat_id.toUpperCase()]) {
    cat_id = code_to_id[cat_id.toUpperCase()];
  }

  return cat_info[cat_id] || unknownCatId(cat_id);
};

const unknownCatId = (cat_id) => {
  return {
    id: cat_id,
    cat_name: `Unknown ${cat_id.slice(0, 5)}...${cat_id.slice(
      cat_id.length - 5
    )}`,
    cat_code: `Unknown ${cat_id.slice(0, 5)}...${cat_id.slice(
      cat_id.length - 5
    )}`,
    is_unknown: true,
  };
};

const updateCatInfo = async () => {
  const results = await pool.query(
    `select * from "${getTableName()}_cats_info"`
  );
  // TODO: consider clearing out id's from the cache which weren't found
  for (let i = 0; i < results.rows.length; i++) {
    const row = results.rows[i];
    cat_info[row["id"]] = {
      id: row["id"],
      cat_name: row["name"],
      cat_code: row["code"],
      mojos_per_coin: row["mojos_per_coin"],
    };
    code_to_id[row["code"]] = row["id"];
  }
  lastUpdate = new Date().toISOString();
};

module.exports.getCatInfo = getCatInfo;
module.exports.cat_info = cat_info;
