/// <reference path="../../pb_data/types.d.ts" />
// The "welcome" email, sent once an address is verified (mail.pb.js). Best-effort: a failure is
// logged, never thrown, so confirming an address or signing up never fails because of mail.

function sendWelcome(record) {
  try {
    const { internalToken } = require(`${__hooks}/lib/internal-token.js`);
    const mailUrl = $os.getenv("MAIL_URL") || "http://127.0.0.1:8788";
    const res = $http.send({
      url: `${mailUrl}/mail/send`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalToken()}` },
      body: JSON.stringify({
        to: record.email(),
        template: "welcome",
        data: {
          name: record.getString("name"),
          locale: record.getString("locale") || "en",
        },
      }),
      timeout: 5,
    });
    if (res.statusCode >= 300) console.log(`[mail] welcome email refused: ${res.statusCode}`);
  } catch (err) {
    console.log("[mail] welcome email failed:", String(err));
  }
}

module.exports = { sendWelcome };
