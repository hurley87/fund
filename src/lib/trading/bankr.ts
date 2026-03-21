const BANKR_API_URL = "https://api.bankr.bot/agent";

function getApiKey(): string {
  const key = process.env.BANKR_API_KEY;
  if (!key) throw new Error("BANKR_API_KEY environment variable is not set");
  return key;
}

interface ExecuteTradeParams {
  direction: "long" | "short";
  asset: string;
  leverage: number;
  size: number;
  stopPrice: number;
  tpPrice: number;
}

export async function executeTrade(params: ExecuteTradeParams): Promise<string> {
  const { direction, asset, leverage, size, stopPrice, tpPrice } = params;
  const prompt = `open a ${direction} position on ${asset} with ${leverage}x leverage, $${size.toFixed(2)} collateral, stop loss at $${stopPrice.toFixed(2)}, take profit at $${tpPrice.toFixed(2)} on Avantis via Base`;

  const res = await fetch(`${BANKR_API_URL}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    throw new Error(`Bankr API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { jobId: string };
  return data.jobId;
}

export async function pollJob(
  jobId: string
): Promise<{ status: string; txHash?: string }> {
  const res = await fetch(`${BANKR_API_URL}/job/${jobId}`, {
    headers: { "X-API-Key": getApiKey() },
  });

  if (!res.ok) {
    throw new Error(`Bankr poll error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { status: string; txHash?: string };
}

interface CloseTradeParams {
  asset: string;
  direction: "long" | "short";
}

export async function closeTrade(params: CloseTradeParams): Promise<string> {
  const prompt = `close ${params.direction} position on ${params.asset} on Avantis via Base`;

  const res = await fetch(`${BANKR_API_URL}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    throw new Error(`Bankr API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { jobId: string };
  return data.jobId;
}
