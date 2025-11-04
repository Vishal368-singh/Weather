// backend/server.js
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
//app.use(cors());
app.use(
  cors({
    origin: "http://localhost:4200",
  })
);
app.use(bodyParser.json({ limit: "10mb" }));

app.post("/send-pdf-email", async (req, res) => {
  const { base64, email, filename } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "post@mlinfomap.com",
      pass: "tmisxyakmbllotlw",
    },
  });

  const mailOptions = {
    from: "post@mlinfomap.com",
    to: email,
    subject: "Weather Bulletin PDF",
    text: "Attached is the PDF you requested.",
    attachments: [
      {
        filename: filename,
        content: Buffer.from(base64, "base64"),
        contentType: "application/pdf",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(3000, () => console.log("Backend running at http://localhost:4200"));
