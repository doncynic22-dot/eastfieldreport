async function run() {
  const url = "https://tigcnyawfhcxcdjqdfaf.supabase.co/rest/v1/";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ2NueWF3ZmhjeGNkanFkZmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjY3MDksImV4cCI6MjA5OTg0MjcwOX0.Zt0-yT0RHcjzVsuC1ngohpU1SJfX8O1RtRafosEFZvc";
  try {
    const res = await fetch(url, {
      headers: { "apikey": key }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body preview:", text.substring(0, 1000));
    const schema = JSON.parse(text);
    if (schema.definitions) {
      console.log("Tables found:", Object.keys(schema.definitions));
    } else {
      console.log("No definitions found in response.");
    }
  } catch (err) {
    console.error(err);
  }
}
run();
