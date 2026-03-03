const crypto = require("crypto");
const pool = require("./db");

const handleWompiWebhook = async (req, res) => {
  try {
    const { event, data, signature, timestamp } = req.body;

    if (!event || !data || !signature || !timestamp) {
      return res.status(400).send("Invalid payload");
    }

    const transaction = data.transaction;

    /* ==========================================
       VALIDAR FIRMA
    ========================================== */

    const stringToSign =
      transaction.id +
      transaction.status +
      transaction.amount_in_cents +
      timestamp +
      process.env.WOMPI_EVENTS_SECRET;

    const expectedSignature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    if (expectedSignature !== signature.checksum) {
      console.error("⚠️ Firma inválida.");
      return res.status(401).send("Invalid signature");
    }

    /* ==========================================
       SI ESTÁ APROBADO → GUARDAR
    ========================================== */

    if (event === "transaction.updated" && transaction.status === "APPROVED") {

      const wompiId = transaction.id;
      const email = transaction.customer_email;
      const amount = transaction.amount_in_cents;
      const status = transaction.status;

      // Evitar duplicados
      const existing = await pool.query(
        "SELECT id FROM transactions WHERE wompi_id = $1",
        [wompiId]
      );

      if (existing.rows.length > 0) {
        console.log("⚠️ Transacción ya registrada.");
        return res.status(200).send("Already processed");
      }

      await pool.query(
        `INSERT INTO transactions (wompi_id, email, amount, status)
         VALUES ($1, $2, $3, $4)`,
        [wompiId, email, amount, status]
      );

      console.log("✅ Pago guardado correctamente.");
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Error webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
};

module.exports = { handleWompiWebhook };