import assert from "node:assert/strict";
import test from "node:test";
import { ModelCatalogError, OpenRouterModelCatalog } from "./model-catalog.js";

const models = [
  {
    id: "acme/text",
    name: "Text",
    architecture: { modality: "text" },
    pricing: { prompt: "0.000001", completion: "0.000002" },
  },
  { id: "acme/image", architecture: { modality: "image" } },
  {
    id: "costly/text",
    architecture: { modality: "text" },
    pricing: { prompt: "0.000001", completion: "0.000021" },
  },
  { id: "free/text", architecture: { modality: "text" } },
];
const fetcher: typeof fetch = async () => Response.json({ data: models });

test("filters catalog to text models and exposes pricing states", async () => {
  const catalog = await new OpenRouterModelCatalog("key", fetcher).list();
  assert.deepEqual(
    catalog.map(({ id, pricingStatus }) => [id, pricingStatus]),
    [
      ["free/text", "missing"],
      ["acme/text", "available"],
    ],
  );
});
test("supports search and including expensive models", async () => {
  const catalog = new OpenRouterModelCatalog("key", fetcher);
  assert.deepEqual(
    (await catalog.list({ search: "acme" })).map((item) => item.id),
    ["acme/text"],
  );
  assert.equal(
    (await catalog.list({ includeExpensive: true })).find(
      (item) => item.id === "costly/text",
    )?.pricingStatus,
    "expensive",
  );
});
test("turns upstream failures into a stable adapter error", async () => {
  await assert.rejects(
    () =>
      new OpenRouterModelCatalog(
        "key",
        async () => new Response(null, { status: 500 }),
      ).list(),
    ModelCatalogError,
  );
});
