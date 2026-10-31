// The flows the site has a tab for, in tab order. A run of any other flow is
// left out by the build, unchecked.
export const FLOWS = [
  { id: 'receipt-lines', name: 'Receipt lines', colour: '#0F6E6E' },
  { id: 'promo-extraction', name: 'Promos', colour: '#9A4A12' },
];

export const DEFAULT_FLOW = FLOWS[0].id;

export function flowById(id) {
  return FLOWS.find((flow) => flow.id === id);
}
