// overwatch 2 server regions ~ inspired by dropship (github.com/stowmyy/dropship)
//
// ip ranges are factual data:
//   - blizzard ranges are static
//   - google cloud ranges live in data/gcp-snapshot.json and are refreshed
//     at runtime from https://www.gstatic.com/ipranges/cloud.json
//
// each region gets one outbound windows firewall rule named after its token.

export const regions = [
  {
    token: 'ams1',
    title: 'netherlands',
    flag: '🇳🇱',
    ping: '137.221.78.60',
    blizzard: ['64.224.26.0/23'],
    gcpScope: null,
  },
  {
    token: 'gbr1',
    title: 'brazil 2',
    flag: '🇧🇷',
    ping: '34.39.128.0',
    blizzard: [],
    gcpScope: 'southamerica-east1',
  },
  {
    token: 'gen1',
    title: 'finland 2',
    flag: '🇫🇮',
    ping: '34.88.0.1',
    blizzard: [],
    gcpScope: 'europe-north1',
  },
  {
    token: 'gmec2',
    title: 'saudi arabia',
    flag: '🇸🇦',
    ping: '34.166.0.84',
    blizzard: [],
    gcpScope: 'me-central2',
  },
  {
    token: 'gsg1',
    title: 'singapore 2',
    flag: '🇸🇬',
    ping: '34.1.128.4',
    blizzard: [],
    gcpScope: 'asia-southeast1',
  },
  {
    token: 'gtk1',
    title: 'japan 2',
    flag: '🇯🇵',
    ping: '34.84.0.0',
    blizzard: [],
    gcpScope: 'asia-northeast1',
  },
  {
    token: 'gue4',
    title: 'usa · east 2',
    flag: '🇺🇸',
    ping: '8.228.65.52',
    blizzard: [],
    gcpScope: 'us-east4',
  },
  {
    token: 'las1',
    title: 'usa · southwest',
    flag: '🇺🇸',
    ping: '34.16.128.42',
    blizzard: ['64.224.24.0/23'],
    gcpScope: null,
  },
  {
    token: 'ord1',
    title: 'usa · central',
    flag: '🇺🇸',
    ping: '8.34.210.23',
    blizzard: ['64.224.0.0/21', '24.105.40.0/21'],
    gcpScope: null,
  },
  {
    token: 'syd2',
    title: 'australia 3',
    flag: '🇦🇺',
    ping: '34.40.128.34',
    blizzard: ['158.115.196.0/23'],
    gcpScope: null,
  },
  {
    token: 'tpe1',
    title: 'taiwan',
    flag: '🇹🇼',
    ping: '34.80.0.0',
    blizzard: ['5.42.160.0/22', '5.42.164.0/22'],
    gcpScope: null,
  },
];

/** all ip ranges (cidr strings) that belong to one region */
export function cidrsFor(region, gcp = {}) {
  const fromScope = region.gcpScope ? (gcp[region.gcpScope] ?? []) : [];
  return [...region.blizzard, ...fromScope];
}
