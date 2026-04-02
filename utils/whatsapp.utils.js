"use strict";

const https = require("https");

// ─── Provider Config ───

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

const HUBTEL_CLIENT_ID = process.env.HUBTEL_CLIENT_ID;
const HUBTEL_CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET;
const HUBTEL_SENDER_ID = process.env.HUBTEL_SENDER_ID || "ElysiumTours";

// ─── Hubtel SMS (Ghana-focused, primary SMS provider) ───

/**
 * Send SMS via Hubtel SMSC API
 * @param {string} to — phone number (e.g., "233246836242")
 * @param {string} message — SMS body
 * @returns {Promise<Object>}
 */
async function sendViaHubtel(to, message) {
	const params = new URLSearchParams({
		clientsecret: HUBTEL_CLIENT_SECRET,
		clientid: HUBTEL_CLIENT_ID,
		from: HUBTEL_SENDER_ID,
		to,
		content: message,
	});

	const url = `https://smsc.hubtel.com/v1/messages/send?${params.toString()}`;

	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			let data = "";
			res.on("data", (chunk) => { data += chunk; });
			res.on("end", () => {
				try {
					const parsed = JSON.parse(data);
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve({ success: true, provider: "hubtel", data: parsed });
					} else {
						resolve({ success: false, provider: "hubtel", error: parsed.Message || data, statusCode: res.statusCode });
					}
				} catch (e) {
					resolve({ success: false, provider: "hubtel", error: data, statusCode: res.statusCode });
				}
			});
		}).on("error", (err) => {
			reject({ success: false, provider: "hubtel", error: err.message });
		});
	});
}

// ─── Twilio SMS (fallback) ───

async function sendViaTwilio(to, message) {
	const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
	const result = await twilio.messages.create({
		from: process.env.TWILIO_SMS_FROM || TWILIO_WHATSAPP_FROM.replace("whatsapp:", ""),
		to,
		body: message,
	});
	return { success: true, provider: "twilio", sid: result.sid };
}

// ─── Public API ───

/**
 * Send SMS — tries Hubtel first (Ghana-focused), falls back to Twilio
 */
async function sendSMS(to, message) {
	// Try Hubtel first (primary for Ghana)
	if (HUBTEL_CLIENT_ID && HUBTEL_CLIENT_SECRET) {
		try {
			const result = await sendViaHubtel(to, message);
			if (result.success) return result;
			console.warn(`[SMS] Hubtel failed, falling back to Twilio:`, result.error);
		} catch (err) {
			console.warn(`[SMS] Hubtel error, falling back to Twilio:`, err.error || err.message);
		}
	}

	// Fallback to Twilio
	if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
		try {
			return await sendViaTwilio(to, message);
		} catch (error) {
			console.error(`[SMS] Twilio also failed for ${to}:`, error.message);
			return { success: false, provider: "twilio", error: error.message };
		}
	}

	// No provider configured — stub
	console.log(`[SMS STUB] To: ${to}, Message: ${message.substring(0, 100)}...`);
	return { success: true, stub: true, sid: `STUB_${Date.now()}` };
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendWhatsApp(to, message) {
	if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
		console.log(`[WhatsApp STUB] To: ${to}, Message: ${message.substring(0, 100)}...`);
		return { success: true, stub: true, sid: `STUB_${Date.now()}` };
	}

	try {
		const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
		const result = await twilio.messages.create({
			from: TWILIO_WHATSAPP_FROM,
			to: `whatsapp:${to}`,
			body: message,
		});
		return { success: true, provider: "twilio", sid: result.sid };
	} catch (error) {
		console.error(`[WhatsApp] Failed to send to ${to}:`, error.message);
		return { success: false, provider: "twilio", error: error.message };
	}
}

module.exports = { sendWhatsApp, sendSMS, sendViaHubtel, sendViaTwilio };
