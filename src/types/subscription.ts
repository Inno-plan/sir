export type Tier =
  | 'white'
  | 'red'
  | 'blue'
  | 'black'
  | 'white_plus'
  | 'red_plus'
  | 'blue_plus'
  | 'black_plus';

export type ContractType = 'trial' | 'paid';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  trial: '무료 체험',
  paid: '정식',
};

export const TIER_LABELS: Record<Tier, string> = {
  white: '화이트',
  red: '레드',
  blue: '블루',
  black: '블랙',
  white_plus: '화이트+',
  red_plus: '레드+',
  blue_plus: '블루+',
  black_plus: '블랙+',
};

export const TIER_OPTIONS: Tier[] = [
  'white',
  'red',
  'blue',
  'black',
  'white_plus',
  'red_plus',
  'blue_plus',
  'black_plus',
];

export interface TierFeatures {
  has_daily: boolean;
  has_armor: boolean;
  has_booster: boolean;
}

export const TIER_FEATURES: Record<Tier, TierFeatures> = {
  white: { has_daily: false, has_armor: false, has_booster: false },
  red: { has_daily: false, has_armor: true, has_booster: false },
  blue: { has_daily: false, has_armor: false, has_booster: true },
  black: { has_daily: false, has_armor: true, has_booster: true },
  white_plus: { has_daily: true, has_armor: false, has_booster: false },
  red_plus: { has_daily: true, has_armor: true, has_booster: false },
  blue_plus: { has_daily: true, has_armor: false, has_booster: true },
  black_plus: { has_daily: true, has_armor: true, has_booster: true },
};

export type SubscriptionDuration = 1 | 3 | 6 | 12;

export const DURATION_OPTIONS: { value: SubscriptionDuration; label: string }[] = [
  { value: 1, label: '1개월' },
  { value: 3, label: '3개월' },
  { value: 6, label: '6개월' },
  { value: 12, label: '1년' },
];
