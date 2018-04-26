const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const Ratelimiter = require("./util/Ratelimiter");
const Uploads = require("./controllers/uploads.js");

const app = express();
const ratelimiter = new Ratelimiter();

app.use(morgan("dev"));
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(ratelimiter.middleware.bind(ratelimiter));

app.set("trust proxy", 1);

app.get("/", (req, res) => res.status(200).json({ message: "Welcome to a file server" }));

app.post("/upload", Uploads.upload);

app.listen(3555, () => console.log("Image server is booted up on port 3555"));

