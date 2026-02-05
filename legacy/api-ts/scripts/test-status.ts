async function test() {
  const url = 'http://localhost:3001/v2/setup/status?check_permissions=true';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
test();
