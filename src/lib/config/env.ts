function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get openaiApiKey() {
    return required('OPENAI_API_KEY');
  },
  get bankrApiKey() {
    return required('BANKR_API_KEY');
  },
  get cronSecret() {
    return required('CRON_SECRET');
  },
  get orchestratorPrivateKey() {
    return required('ORCHESTRATOR_PRIVATE_KEY');
  },
  get accountingContractAddress() {
    return required('ACCOUNTING_CONTRACT_ADDRESS');
  },
  get erc8004RegistryAddress() {
    return optional(
      'ERC8004_REGISTRY_ADDRESS',
      '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
    )!;
  },
} as const;
