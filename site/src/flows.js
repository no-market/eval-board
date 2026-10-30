// The flows the site has a tab for, in tab order. A run of any other flow is
// checked by the build and left out of the index.
export const FLOWS = [
  { id: 'receipt-lines', name: 'Receipt lines', colour: '#0F6E6E' },
];

export const DEFAULT_FLOW = FLOWS[0].id;

export function flowById(id) {
  return FLOWS.find((flow) => flow.id === id);
}
