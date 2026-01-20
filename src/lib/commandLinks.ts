export type CommandLink = {
  key: string
  label: string
  eveTypeName?: string
}

export type CommandLinkGroup = {
  name: string
  links: CommandLink[]
}

export const COMMAND_LINK_GROUPS: CommandLinkGroup[] = [
  {
    name: 'Armor',
    links: [
      { key: 'armor_energizing', label: 'Armor Energizing', eveTypeName: 'Armor Energizing Charge' },
      { key: 'armor_reinforcement', label: 'Armor Reinforcement', eveTypeName: 'Armor Reinforcement Charge' },
      { key: 'rapid_repair', label: 'Rapid Repair', eveTypeName: 'Rapid Repair Charge' },
    ],
  },
  {
    name: 'Shield',
    links: [
      { key: 'active_shielding', label: 'Active Shielding', eveTypeName: 'Active Shielding Charge' },
      { key: 'shield_extension', label: 'Shield Extension', eveTypeName: 'Shield Extension Charge' },
      { key: 'shield_harmonizing', label: 'Shield Harmonizing', eveTypeName: 'Shield Harmonizing Charge' },
    ],
  },
  {
    name: 'Skirmish',
    links: [
      { key: 'evasive_maneuvers', label: 'Evasive Maneuvers', eveTypeName: 'Evasive Maneuvers Charge' },
      { key: 'interdiction_maneuvers', label: 'Interdiction Maneuvers', eveTypeName: 'Interdiction Maneuvers Charge' },
      { key: 'rapid_deployment', label: 'Rapid Deployment', eveTypeName: 'Rapid Deployment Charge' },
    ],
  },
  {
    name: 'Information',
    links: [
      { key: 'electronic_superiority', label: 'Electronic Superiority', eveTypeName: 'Electronic Superiority Charge' },
      { key: 'sensor_optimization', label: 'Sensor Optimization', eveTypeName: 'Sensor Optimization Charge' },
      { key: 'electronic_hardening', label: 'Electronic Hardening', eveTypeName: 'Electronic Hardening Charge' },
    ],
  },
  {
    name: 'Expedition',
    links: [
      { key: 'expedition_strength', label: 'Expedition Strength', eveTypeName: 'Expedition Strength Charge' },
      { key: 'expedition_reach', label: 'Expedition Reach', eveTypeName: 'Expedition Reach Charge' },
      { key: 'expedition_pinpointing', label: 'Expedition Pinpointing', eveTypeName: 'Expedition Pinpointing Charge' },
    ],
  },
  {
    name: 'Mining',
    links: [
      { key: 'mining_laser_optimization', label: 'Mining Laser Optimization', eveTypeName: 'Mining Laser Optimization Charge' },
      {
        key: 'mining_laser_field_enhancement',
        label: 'Mining Laser Field Enhancement',
        eveTypeName: 'Mining Laser Field Enhancement Charge',
      },
      {
        key: 'mining_equipment_preservation',
        label: 'Mining Equipment Preservation',
        eveTypeName: 'Mining Equipment Preservation Charge',
      },
    ],
  },
]

export function allCommandLinkKeys(): string[] {
  return COMMAND_LINK_GROUPS.flatMap((group) => group.links.map((link) => link.key))
}
