import type {
  ModelCatalogEntry,
  ModelModality,
  ModelPricing,
} from "@weather-song-writing/contracts";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const EXPENSIVE_COMPLETION_USD_PER_MILLION = 20;

interface OpenRouterModel {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly context_length?: unknown;
  readonly architecture?: { readonly modality?: unknown };
  readonly pricing?: {
    readonly prompt?: unknown;
    readonly completion?: unknown;
  };
}

interface OpenRouterResponse {
  readonly data?: unknown;
}

export class ModelCatalogError extends Error {}

export class OpenRouterModelCatalog {
  constructor(
    // Kept in the constructor because generation and catalog clients share
    // configuration, but OpenRouter's model catalog is public.
    _apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async list(
    options: {
      search?: string;
      provider?: string;
      includeExpensive?: boolean;
    } = {},
  ): Promise<ModelCatalogEntry[]> {
    let response: Response;
    try {
      response = await this.fetcher(OPENROUTER_MODELS_URL);
    } catch {
      throw new ModelCatalogError(
        "OpenRouter model catalog is temporarily unavailable.",
      );
    }
    if (!response.ok)
      throw new ModelCatalogError(
        "OpenRouter model catalog is temporarily unavailable.",
      );
    const body = (await response.json()) as OpenRouterResponse;
    if (!Array.isArray(body.data))
      throw new ModelCatalogError(
        "OpenRouter returned an invalid model catalog.",
      );
    const query = options.search?.trim().toLowerCase();
    return body.data
      .map(normalizeModel)
      .filter((entry): entry is ModelCatalogEntry => entry !== null)
      .filter((entry) => entry.supportedModalities.includes("text"))
      .filter(
        (entry) =>
          options.includeExpensive || entry.pricingStatus !== "expensive",
      )
      .filter(
        (entry) =>
          options.provider === undefined || entry.provider === options.provider,
      )
      .filter(
        (entry) =>
          query === undefined ||
          query.length === 0 ||
          `${entry.id} ${entry.displayName}`.toLowerCase().includes(query),
      )
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }
}

function normalizeModel(value: unknown): ModelCatalogEntry | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0)
    return null;
  const source = value as OpenRouterModel;
  const id = value.id;
  const modalities = parseModalities(source.architecture?.modality);
  const pricing = parsePricing(source.pricing);
  const provider = id.includes("/") ? id.split("/", 1)[0]! : null;
  return {
    id,
    displayName:
      typeof source.name === "string" && source.name.length > 0
        ? source.name
        : id,
    provider,
    contextLength:
      typeof source.context_length === "number" &&
      Number.isFinite(source.context_length)
        ? source.context_length
        : null,
    supportedModalities: modalities,
    pricing,
    pricingStatus:
      pricing === null || pricing.completionUsdPerMillionTokens === null
        ? "missing"
        : pricing.completionUsdPerMillionTokens >=
            EXPENSIVE_COMPLETION_USD_PER_MILLION
          ? "expensive"
          : "available",
  };
}

function parseModalities(value: unknown): ModelModality[] {
  if (typeof value !== "string") return ["text"];
  const modalities = value
    .split("+")
    .filter(
      (item): item is ModelModality =>
        item === "text" ||
        item === "image" ||
        item === "audio" ||
        item === "video",
    );
  return modalities.length === 0 ? ["text"] : modalities;
}

function parsePricing(value: unknown): ModelPricing | null {
  if (!isRecord(value)) return null;
  const prompt = dollarsPerTokenToMillion(value.prompt);
  const completion = dollarsPerTokenToMillion(value.completion);
  return prompt === null || completion === null
    ? null
    : {
        promptUsdPerMillionTokens: prompt,
        completionUsdPerMillionTokens: completion,
      };
}

function dollarsPerTokenToMillion(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
    ? parsed * 1_000_000
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
