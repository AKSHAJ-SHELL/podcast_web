const target = process.env.SMOKE_API_URL || "http://localhost:8888/api/contact";

async function main() {
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: "Smoke",
      last_name: "Test",
      email: "smoke@example.com",
      subject: "General Question",
      message: "Smoke test submission",
      website: "",
      consent: true,
      captcha_token: process.env.SMOKE_CAPTCHA_TOKEN || "",
    }),
  });
  const body = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ status: response.status, body }, null, 2));
  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
