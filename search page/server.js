// ===== server.js =====
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== Database Connection =====
const dbConfig = {
  host: "localhost",
  user: "root",       // your MySQL username
  password: "B.Mega16", // your MySQL password
  database: "bus"
};

// ===== Helper to Build Filters =====
function buildFilters(query) {
  const filters = ["from_city = ?", "to_city = ?", "journey_date = ?"];
  const values = [query.from, query.to, query.date];

  // Departure Time
  if(query.departureTime){
    const dep = query.departureTime.split(",");
    filters.push(`departure_time_category IN (${dep.map(()=>"?").join(",")})`);
    values.push(...dep);
  }

  // Arrival Time
  if(query.arrivalTime){
    const arr = query.arrivalTime.split(",");
    filters.push(`arrival_time_category IN (${arr.map(()=>"?").join(",")})`);
    values.push(...arr);
  }

  // Duration
  if(query.duration){
    const durArr = query.duration.split(",");
    const durConditions = [];
    if(durArr.includes("lt6")) durConditions.push("duration_hours < 6");
    if(durArr.includes("6to12")) durConditions.push("duration_hours BETWEEN 6 AND 12");
    if(durArr.includes("gt12")) durConditions.push("duration_hours > 12");
    if(durConditions.length) filters.push(`(${durConditions.join(" OR ")})`);
  }

  // Bus Type (AND logic)
  if(query.busType){
    query.busType.split(",").forEach(t => {
      filters.push("LOWER(bus_type) LIKE ?");
      values.push(`%${t.toLowerCase()}%`);
    });
  }

  // Price
  if(query.minFare) { filters.push("price >= ?"); values.push(query.minFare); }
  if(query.maxFare) { filters.push("price <= ?"); values.push(query.maxFare); }

  // Operator
  if(query.operator) { filters.push("operator_name = ?"); values.push(query.operator); }

  // Seat availability
  if(query.seatsOnly === "true") filters.push("seats_available > 0");

  // Amenities (AND logic)
  if(query.amenities){
    query.amenities.split(",").forEach(a => {
      filters.push(`JSON_CONTAINS(amenities, '"${a}"')`);
    });
  }

  return { filters, values };
}

// ===== API: Search Buses =====
app.get("/search", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const { filters, values } = buildFilters(req.query);

    const sql = `
      SELECT * FROM buses
      WHERE ${filters.join(" AND ")}
      ORDER BY departure_time
    `;

    const [rows] = await connection.execute(sql, values);
    await connection.end();

    if(rows.length === 0) return res.json({ message: "No buses found." });

    res.json(rows);

  } catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Start Server =====
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
