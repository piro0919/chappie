import {
  AppWindow,
  ClipboardCopy,
  Clock,
  CloudSun,
  Globe,
  Hand,
  MessageCircle,
  type Mic,
  Timer,
  Volume2,
} from "lucide-react";

export const CAPABILITY_IDS = [
  "chat",
  "timer",
  "time",
  "weather",
  "web",
  "apps",
  "volume",
  "clipboard",
  "goodbye",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const HERO_CAPABILITY_IDS: readonly CapabilityId[] = [
  "chat",
  "timer",
  "weather",
  "clipboard",
];

export const CAPABILITY_ICONS: Record<CapabilityId, typeof Mic> = {
  chat: MessageCircle,
  timer: Timer,
  time: Clock,
  weather: CloudSun,
  web: Globe,
  apps: AppWindow,
  volume: Volume2,
  clipboard: ClipboardCopy,
  goodbye: Hand,
};

export const CAPABILITY_EXAMPLE_KEYS: Record<CapabilityId, string[]> = {
  chat: ["example1", "example2"],
  timer: ["example1", "example2", "example3"],
  time: ["example1", "example2", "example3"],
  weather: ["example1", "example2", "example3"],
  web: ["example1", "example2", "example3"],
  apps: ["example1", "example2", "example3"],
  volume: ["example1", "example2", "example3"],
  clipboard: ["example1", "example2", "example3"],
  goodbye: ["example1", "example2", "example3"],
};
