const ALLOWED_SUBJECTS = new Set([
  "Guest Suggestion",
  "Collaboration",
  "General Question",
  "Media Inquiry",
  "Other",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function validatePayload(body) {
  const firstName = normalizeValue(body.first_name);
  const lastName = normalizeValue(body.last_name);
  const email = normalizeValue(body.email).toLowerCase();
  const subject = normalizeValue(body.subject);
  const message = normalizeValue(body.message);
  const website = normalizeValue(body.website);
  const consent = body.consent === true;

  if (website) {
    return { ok: true, honeypot: true };
  }
  if (!firstName || !lastName || !email || !subject || !message) {
    return { ok: false, status: 400, error: "All fields are required." };
  }
  if (!consent) {
    return {
      ok: false,
      status: 400,
      error: "Please agree to the privacy notice so we can store your message.",
    };
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return { ok: false, status: 400, error: "Name is too long." };
  }
  if (email.length > 254) {
    return { ok: false, status: 400, error: "Email is too long." };
  }
  if (subject.length > 100 || !ALLOWED_SUBJECTS.has(subject)) {
    return { ok: false, status: 400, error: "Invalid subject." };
  }
  if (message.length > 5000) {
    return { ok: false, status: 400, error: "Message is too long." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, status: 400, error: "Invalid email format." };
  }

  return {
    ok: true,
    honeypot: false,
    data: {
      first_name: firstName,
      last_name: lastName,
      email,
      subject,
      message,
    },
  };
}

module.exports = {
  validatePayload,
};
