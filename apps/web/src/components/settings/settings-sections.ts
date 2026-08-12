export const SETTINGS_SECTION_IDS = [
  'contatos',
  'equipe',
  'biometria',
  'reset',
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  hint: string;
  danger?: boolean;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    id: 'conta',
    label: 'Conta',
    items: [
      {
        id: 'contatos',
        label: 'Contatos',
        hint: 'Identidade nas mensagens aos clientes',
      },
      {
        id: 'equipe',
        label: 'Equipe',
        hint: 'Quem acessa a gestao da consultoria',
      },
    ],
  },
  {
    id: 'privacidade',
    label: 'Privacidade',
    items: [
      {
        id: 'biometria',
        label: 'Retencao biometrica',
        hint: 'Exclusao segura de face (LGPD)',
      },
    ],
  },
  {
    id: 'risco',
    label: 'Zona de risco',
    items: [
      {
        id: 'reset',
        label: 'Reset geral',
        hint: 'Apaga dados de teste deste tenant',
        danger: true,
      },
    ],
  },
];

export function parseSettingsSection(
  raw: string | null | undefined,
): SettingsSectionId {
  if (raw && (SETTINGS_SECTION_IDS as readonly string[]).includes(raw)) {
    return raw as SettingsSectionId;
  }
  return 'contatos';
}
