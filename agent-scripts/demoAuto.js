let response;
try {
  response = await fetch("http://127.0.0.1:8787/demo/auto", { method: "POST" });
} catch {
  console.error("npm run qa 가 먼저 떠 있어야 합니다.");
  process.exit(1);
}
const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(1);
}
console.log(text);
