export type BridgeRole = 'AP' | 'ST' | 'UNKNOWN';

type Metadata = Record<string, unknown> | undefined | null;

type RoleCandidate = string | number | boolean | undefined | null;

const normalizeString = (value: RoleCandidate): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value).trim().toLowerCase();
};

const ROLE_KEYS = [
  'role',
  'bridgeRole',
  'bridge_mode',
  'bridgeMode',
  'mode',
  'type',
  'category',
  'kind',
  'model'
];

export const resolveBridgeRole = (
  metadata?: Metadata,
  name?: string
): BridgeRole => {
  const candidates: string[] = [];

  ROLE_KEYS.forEach((key) => {
    if (!metadata || !(key in metadata)) return;
    candidates.push(normalizeString((metadata as Record<string, unknown>)[key] as RoleCandidate));
  });

  if (metadata && typeof metadata === 'object') {
    if ('isAp' in metadata) {
      const flag = Boolean((metadata as Record<string, unknown>).isAp);
      candidates.push(flag ? 'ap' : 'st');
    }
    if ('isStation' in metadata) {
      const flag = Boolean((metadata as Record<string, unknown>).isStation);
      candidates.push(flag ? 'st' : 'ap');
    }
  }

  if (name) {
    candidates.push(normalizeString(name));
  }

  for (const value of candidates) {
    if (!value) continue;
    if (value.includes('ap') || value.includes('access point') || value.includes('master')) {
      return 'AP';
    }
    if (
      value.includes('st') ||
      value.includes('station') ||
      value.includes('client') ||
      value.includes('slave') ||
      value.includes('subscriber')
    ) {
      return 'ST';
    }
  }

  return 'UNKNOWN';
};
