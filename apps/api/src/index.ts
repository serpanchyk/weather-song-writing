export default {
  fetch(): Response {
    return Response.json({ status: "ok", service: "weather-song-writing-api" });
  },
} satisfies ExportedHandler;
