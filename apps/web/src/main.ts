import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main>
    <h1>Weather Song Writing</h1>
    <p>Frontend foundation ready. API: ${apiBaseUrl}</p>
  </main>
`;
