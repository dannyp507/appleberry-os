const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();
const db = admin.firestore();
const firebaseEventSecret = defineSecret("WHATSAPP_EVENT_SECRET");

exports.syncWhatsAppEvent = onRequest({ secrets: [firebaseEventSecret] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedSecret = firebaseEventSecret.value() || "";
  const incomingSecret = req.get("X-Firebase-Bridge-Secret") || "";

  if (expectedSecret && incomingSecret !== expectedSecret) {
    res.status(403).json({ error: "Invalid bridge secret" });
    return;
  }

  const eventType = req.body?.event_type;
  const payload = req.body?.payload || {};
  const tenantId = String(payload.tenant_id || "");

  if (!eventType || !tenantId) {
    res.status(400).json({ error: "Missing event_type or tenant_id" });
    return;
  }

  const eventRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("events")
    .doc();

  const eventData = {
    eventType,
    payload,
    occurredAt: req.body?.occurred_at || new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const writes = [eventRef.set(eventData)];

  if (eventType === "conversation.created" && payload.conversation_id) {
    const conversationRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("conversations")
      .doc(String(payload.conversation_id));

    writes.push(
      conversationRef.set(
        {
          tenantId,
          contactId: payload.contact_id || null,
          channelId: payload.channel_id || null,
          botId: payload.bot_id || null,
          contactName: payload.contact_name || null,
          phoneNumber: payload.phone_number || null,
          status: payload.status || "open",
          lastMessageAt: payload.last_message_at || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  }

  if (eventType === "message.created" && payload.conversation_id && payload.message_id) {
    const conversationRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("conversations")
      .doc(String(payload.conversation_id));

    const messageRef = conversationRef
      .collection("messages")
      .doc(String(payload.message_id));

    writes.push(
      messageRef.set(
        {
          tenantId,
          conversationId: payload.conversation_id,
          direction: payload.direction || null,
          type: payload.type || "text",
          content: payload.content || "",
          status: payload.status || null,
          triggeredBy: payload.triggered_by || null,
          createdAt: payload.created_at || null,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );

    writes.push(
      conversationRef.set(
        {
          lastMessageAt: payload.created_at || new Date().toISOString(),
          lastMessagePreview: payload.content || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  }

  await Promise.all(writes);
  res.status(200).json({ success: true });
});
