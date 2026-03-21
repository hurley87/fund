import OpenAI from 'openai';
import { env } from '@/lib/config/env';
import { getSupabase } from '@/lib/db/supabase';
import { Genome, ASSET_ALLOWLIST } from '@/lib/evolution/genome';

let _openai: OpenAI | undefined;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: env.openaiApiKey });
  return _openai;
}

export interface Personality {
  name: string;
  description: string;
  visual_motifs: string[];
  image_prompt: string;
}

export async function generatePersonality(genome: Genome): Promise<Personality> {
  const asset = ASSET_ALLOWLIST[genome.asset];

  const signalDesc =
    genome.signal_bias > 0.6
      ? 'aggressive, momentum-driven, forward-charging'
      : genome.signal_bias < 0.4
        ? 'patient, contrarian, calculated'
        : 'balanced, adaptive';

  const leverageDesc =
    genome.leverage > 6
      ? 'reckless, high-energy, volatile'
      : genome.leverage < 4
        ? 'conservative, armored, defensive'
        : 'measured, steady';

  const entryDesc =
    genome.entry_threshold > 0.06
      ? 'selective, zen, waits for the perfect moment'
      : 'opportunistic, always scanning';

  const assetMotifs: Record<string, string> = {
    ETH: 'crystalline structures, purple/blue energy, ethereal geometry',
    BTC: 'golden circuits, volcanic fire, ancient runes, digital gold',
    SOL: 'solar flares, neon speed lines, prismatic light, velocity',
  };

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a creative director for a mutant trading fund. Generate a cohesive personality for a mutant trader. Respond in JSON with keys: name (string, short memorable name), description (string, max 500 chars), visual_motifs (string array, 3-5 items), image_prompt (string, detailed prompt for DALL-E 3 to generate a square logo/avatar).`,
      },
      {
        role: 'user',
        content: `Create a personality for a mutant trader with these traits:
- Temperament: ${signalDesc}
- Risk style: ${leverageDesc}
- Entry behavior: ${entryDesc}
- Primary asset: ${asset}
- Asset visual themes: ${assetMotifs[asset]}
- Leverage: ${genome.leverage.toFixed(1)}x
- Stop loss: ${(genome.stop_loss * 100).toFixed(1)}%
- Take profit: ${(genome.take_profit * 100).toFixed(1)}%
- Position size: ${(genome.position_size_pct * 100).toFixed(1)}%
- Timeframe: ${genome.timeframe_hours.toFixed(1)} hours

The name, description, and image prompt must all align to one coherent character/personality. Make it vivid and memorable.`,
      },
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(content) as Personality;

  // Enforce description length limit
  if (parsed.description.length > 500) {
    parsed.description = parsed.description.slice(0, 497) + '...';
  }

  return parsed;
}

export async function generateImage(imagePrompt: string): Promise<Buffer> {
  const response = await getOpenAI().images.generate({
    model: 'dall-e-3',
    prompt: imagePrompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned from OpenAI');

  return Buffer.from(b64, 'base64');
}

export async function uploadImage(
  mutantId: string,
  imageBuffer: Buffer,
): Promise<string> {
  const supabase = getSupabase();
  const path = `${mutantId}/logo.png`;

  const { error } = await supabase.storage
    .from('trader-assets')
    .upload(path, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('trader-assets')
    .getPublicUrl(path);

  return data.publicUrl;
}
