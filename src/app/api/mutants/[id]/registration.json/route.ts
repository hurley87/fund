import { NextResponse } from "next/server";
import { mutants } from "@/lib/db/supabase";

const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let mutant;
  try {
    mutant = await mutants.getById(id);
  } catch {
    return NextResponse.json({ error: "Mutant not found" }, { status: 404 });
  }

  if (!mutant) {
    return NextResponse.json({ error: "Mutant not found" }, { status: 404 });
  }

  const genome = mutant.genome ?? {};

  return NextResponse.json({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: mutant.name ?? `Mutant #${mutant.id}`,
    description: mutant.description ?? "",
    image: mutant.image_url ?? "",
    active: mutant.lifecycle_status === "active",
    x402Support: true,
    services: [
      {
        name: "Mutant Fund API",
        endpoint: `/api/mutants/${id}`,
      },
    ],
    registrations: mutant.agent_id != null
      ? [
          {
            agentId: mutant.agent_id,
            agentRegistry: REGISTRY_ADDRESS,
          },
        ]
      : [],
    traits: {
      generation: mutant.generation,
      parents: mutant.parent_ids ?? [],
      risk_tolerance: genome.risk_tolerance,
      time_horizon: genome.time_horizon,
      strategy_weights: genome.strategy_weights,
      stop_loss_pct: genome.stop_loss_pct,
      take_profit_pct: genome.take_profit_pct,
      max_leverage: genome.max_leverage,
      fitness: mutant.fitness,
      lifecycle_status: mutant.lifecycle_status,
    },
  });
}
