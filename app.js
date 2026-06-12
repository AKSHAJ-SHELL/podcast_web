"use strict";

const CONTACT_ENDPOINT = "/api/contact";
const CONTACT_ALLOWED_SUBJECTS = new Set([
  "Guest Suggestion",
  "Collaboration",
  "General Question",
  "Media Inquiry",
  "Other"
]);

function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + name);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-links a, .nav-btn").forEach((a) => a.classList.remove("active"));
  const navEl = document.getElementById("nav-" + name);
  if (navEl) navEl.classList.add("active");
  window.scrollTo(0, 0);
}

function filterTopic(el, topic) {
  document.querySelectorAll(".topic-tag").forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  document.querySelectorAll(".episode-item").forEach((item) => {
    const topicMatch = topic === "all" || item.dataset.topic === topic || item.dataset.season === topic;
    item.style.display = topicMatch ? "grid" : "none";
  });
  document.querySelectorAll(".season-header").forEach((h) => {
    h.style.display = topic === "all" || h.dataset.season === topic ? "block" : "none";
  });
}

function filterEpisodes() {
  const q = document.getElementById("ep-search").value.toLowerCase();
  document.querySelectorAll(".episode-item").forEach((item) => {
    const text = item.innerText.toLowerCase();
    item.style.display = text.includes(q) ? "grid" : "none";
  });
}

function setContactStatus(message, isError) {
  const statusEl = document.getElementById("contact-status");
  if (!statusEl) return;
  statusEl.style.display = "block";
  statusEl.style.color = isError ? "#ff7f7f" : "var(--teal)";
  statusEl.textContent = message;
}

async function handleContactSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitBtn = document.getElementById("contact-submit-btn");
  const formData = new FormData(form);

  const payload = {
    first_name: String(formData.get("first_name") || "").trim(),
    last_name: String(formData.get("last_name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    website: String(formData.get("website") || "").trim(),
    consent: formData.get("consent") === "on"
  };

  if (
    !payload.first_name ||
    !payload.last_name ||
    !payload.email ||
    !payload.subject ||
    !payload.message
  ) {
    setContactStatus("Please fill out all fields before submitting.", true);
    return;
  }

  if (!payload.consent) {
    setContactStatus("Please agree to the privacy notice before submitting.", true);
    return;
  }

  if (!CONTACT_ALLOWED_SUBJECTS.has(payload.subject)) {
    setContactStatus("Please select a valid subject.", true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";
  setContactStatus("Sending your message...", false);

  try {
    const response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const errorMessage = data.error || "Something went wrong. Please try again.";
      throw new Error(errorMessage);
    }

    form.reset();
    setContactStatus("Message sent! We will get back to you soon.", false);
  } catch (error) {
    setContactStatus(error.message || "Could not send message. Please try again.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Message →";
  }
}

// Delegated handlers replace the former inline on* attributes so the CSP can
// drop 'unsafe-inline' for scripts.
document.addEventListener("click", (event) => {
  const pageLink = event.target.closest("[data-page]");
  if (pageLink) {
    event.preventDefault();
    showPage(pageLink.dataset.page);
    return;
  }

  const topicTag = event.target.closest("[data-filter]");
  if (topicTag) {
    event.preventDefault();
    filterTopic(topicTag, topicTag.dataset.filter);
  }
});

const epSearch = document.getElementById("ep-search");
if (epSearch) {
  epSearch.addEventListener("input", filterEpisodes);
}

document.querySelectorAll("img[data-hide-on-error]").forEach((img) => {
  img.addEventListener("error", () => {
    img.style.display = "none";
  });
  if (img.complete && img.naturalWidth === 0) {
    img.style.display = "none";
  }
});

const contactForm = document.getElementById("contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", handleContactSubmit);
}
