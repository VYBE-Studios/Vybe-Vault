const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5174;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`VYBE Vault running on port ${PORT}`);
});
