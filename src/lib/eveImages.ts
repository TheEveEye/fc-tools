export function eveTypeIconUrl(typeId: number, size = 64): string {
  return `https://images.evetech.net/types/${typeId}/icon?size=${size}`
}

export function eveTypeRenderUrl(typeId: number, size = 64): string {
  return `https://images.evetech.net/types/${typeId}/render?size=${size}`
}
