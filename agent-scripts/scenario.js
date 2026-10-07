let response;
try {
  response = await fetch("http://127.0.0.1:8787/scenario", { method: "POST" });
} catch {
  console.error("Start the scene wallet first: npm run scene");
  process.exit(1);
}
if (!response.ok || !response.body) {
  console.error(await response.text());
  process.exit(1);
}
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const step = await reader.read();
  if (step.done) break;
  process.stdout.write(decoder.decode(step.value));
}
