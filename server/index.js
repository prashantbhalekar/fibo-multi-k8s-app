const cors = require("cors");

const keys = require("./keys");

const express = require("express");
const bodyParser = require("body-parser");
const redis = require("redis");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.error(err));
});

pgClient.on("error", () => console.log("Lost PG connection"));

// Redis client setup
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

// Express route handler
app.get("/", (req, res) => {
  res.send("Hi");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("select * from values");
  console.log("values===>>>", values);
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send("Index is too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);

  pgClient.query("Insert into values(number) VALUES($1)", [index]);
  res.send({ working: true });
});

app.listen(5000, () => {
  console.log("Listening on port 5000!");
});
